import { git, sourcePath } from './snapshot.mjs';

export async function prepareContext(snap, paths, explicit = [], config = {}) {
  const selected = paths.length ? snap.paths.filter(p => paths.some(prefix => p === prefix || p.startsWith(prefix + '/'))) : snap.paths;
  const context = new Set(explicit), notes = [];
  for (const rule of config.contextRules ?? []) {
    if (!Array.isArray(rule.paths) || !Array.isArray(rule.context)) throw new Error('Invalid context rule');
    if (selected.some(p => rule.paths.some(prefix => p === prefix || p.startsWith(prefix + '/'))))
      rule.context.forEach(p => context.add(sourcePath(p)));
  }
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

// An unmerged lower PR is review data, not trusted execution configuration.
export const configurationSnapshot = (snap, stack) => stack ? {...snap, base: stack.layers[0].base} : snap;
