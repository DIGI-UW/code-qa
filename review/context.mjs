import { posix } from 'node:path';
import { git, sourcePath } from './snapshot.mjs';

export async function prepareContext(snap, paths, explicit = [], config = {}, auto = true) {
  const selected = paths.length ? snap.paths.filter(p => paths.some(prefix => p === prefix || p.startsWith(prefix + '/'))) : snap.paths;
  const context = new Set(explicit), notes = [];
  for (const rule of config.contextRules ?? []) {
    if (!Array.isArray(rule.paths) || !Array.isArray(rule.context)) throw new Error('Invalid context rule');
    if (selected.some(p => rule.paths.some(prefix => p === prefix || p.startsWith(prefix + '/'))))
      rule.context.forEach(p => context.add(sourcePath(p)));
  }
  if (auto && selected.length <= 60) {
    const all = (await git(snap.repo, ['ls-tree','-r','--name-only',snap.head])).split('\n');
    const known = new Set(all);
    const add = p => { if (known.has(p) && !selected.includes(p)) context.add(p); };
    for (const path of selected) {
      if (!/\.(java|[cm]?[jt]sx?)$/.test(path)) continue;
      let source;
      try { source = await git(snap.repo,['show',snap.head + ':' + path]); } catch { continue; }
      if (source.length > 100000) { notes.push('Import discovery skipped large file: ' + path); continue; }
      for (const match of source.matchAll(/import\s+(?:static\s+)?([\w.]+);/g)) {
        const imported = match[1].split('.').join('/');
        add('src/main/java/' + imported + '.java');
        add('src/test/java/' + imported + '.java');
      }
      for (const match of source.matchAll(/(?:from\s*|require\(\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
        const target = posix.normalize(posix.join(posix.dirname(path), match[1]));
        for (const suffix of ['', '.js','.jsx','.ts','.tsx','/index.js','/index.ts']) add(target + suffix);
      }
      const stem = posix.basename(path).replace(/\.[^.]+$/, '');
      for (const f of all) if (new RegExp('^' + stem.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&') + '(?:Test|Tests|\\.test|\\.spec)\\.[^.]+$').test(posix.basename(f))) add(f);
      // One-hop references identify unchanged callers, not only imported dependencies.
      if (stem.length > 3 && /^[\w]+$/.test(stem)) {
        try {
          const hits = await commandGrep(snap.repo, snap.head, stem);
          hits.forEach(add);
        } catch (error) { notes.push('Caller discovery unavailable for ' + path + ': ' + error.message); }
      }
    }
  } else if (auto) notes.push('Automatic neighbor discovery skipped above 60 changed files; select a coherent scope or explicit context.');
  const missing = [];
  for (const path of context) {
    sourcePath(path);
    const exists = await git(snap.repo, ['ls-tree',snap.head,'--',path]);
    const old = exists ? '' : await git(snap.repo,['ls-tree',snap.mergeBase,'--',path]);
    if (!exists && !old) missing.push(path);
  }
  if (missing.length) throw new Error('Context files do not exist: ' + missing.join(', '));
  return { contextPaths: [...context].filter(p => !selected.includes(p)).sort(), contextNotes: notes };
}
async function commandGrep(repo, head, stem) {
  // git grep exit 1 means no references, not a failed collector.
  const { command, requireSuccess } = await import('./process.mjs');
  const r = await command(['git','-c','core.hooksPath=/dev/null','-C',repo,'grep','-l','-w','-F',stem,head,'--','*.java','*.js','*.jsx','*.ts','*.tsx']);
  if (r.code === 1) return [];
  requireSuccess(r, 'Find callers');
  return r.stdout.trim().split('\n').filter(Boolean).map(p => p.slice(head.length + 1));
}
export async function trustedConfig(snap, supplied) {
  if (supplied) return supplied;
  const entry = await git(snap.repo,['ls-tree',snap.base,'--','.code-qa.json']);
  if (!entry) return {};
  if (!entry.startsWith('100644 blob ') && !entry.startsWith('100755 blob ')) throw new Error('Base review config must be a regular file');
  return JSON.parse(await git(snap.repo,['show',snap.base + ':.code-qa.json']));
}
export async function configurationRequirements(snap, config) {
  const parts = [];
  for (const path of config.requirementsFiles ?? []) {
    sourcePath(path);
    parts.push('Accepted base requirements: ' + path + '\n' + await git(snap.repo,['show',snap.base + ':' + path]));
  }
  return parts.join('\n\n');
}
