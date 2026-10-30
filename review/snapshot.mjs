import { inspectSources } from './sources.mjs';
import { resolve } from 'node:path';
import { command, requireSuccess } from './process.mjs';

export const SHA = /^[0-9a-f]{40}$/;
export async function git(repo, args) {
  return requireSuccess(await command(['git', '--no-pager', '--literal-pathspecs', '-c', 'core.hooksPath=/dev/null', '-C', repo, ...args]), `git ${args[0]}`).stdout;
}
export function sourcePath(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.split('/').some(p => p === '..' || p === '.') || value.includes('\0')) throw new Error(`Invalid source path: ${value}`);
  return value;
}
export async function revision(repo, ref) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-')) throw new Error('A base/head revision is required');
  const sha = (await git(repo, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`])).trim();
  if (!SHA.test(sha)) throw new Error('Expected a full Git commit');
  return sha;
}

export async function snapshot(repoPath, baseRef, headRef) {
  const repo = resolve(repoPath);
  const base = await revision(repo, baseRef), head = await revision(repo, headRef);
  const mergeBase = (await git(repo, ['merge-base', base, head])).trim();
  const paths = (await git(repo, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', mergeBase, head])).split('\0').filter(Boolean);
  return { repo, baseRef, headRef, base, head, mergeBase, paths };
}

export async function packetFor(plan) {
  const { snapshot: snap } = plan;
  const changed = plan.paths.length ? snap.paths.filter(p => plan.paths.some(prefix => p === prefix || p.startsWith(prefix + '/'))) : snap.paths;
  if (plan.paths.length && !changed.length) throw new Error('Targeted paths do not intersect the changed files');
  // Source is read from the pinned repository on demand, never packed to a byte allowance.
  for (const path of [...changed, ...plan.contextPaths]) sourcePath(path);
  const sources = await inspectSources(plan.sources ?? [],snap);
  return { sources:sources.sources, schemaVersion: 2, sourceAccess: 'repository', snapshot: snap,
    application: plan.application, question: plan.question,
    decisions: plan.decisions ?? [], history: plan.history ?? null, purpose: plan.purpose, requirements: plan.requirements, selectedPaths: changed,
    contextNotes: plan.contextNotes ?? [], pullRequest: plan.pullRequest ? { url: plan.pullRequest.url, title: plan.pullRequest.title, body: plan.pullRequest.body, checks: plan.pullRequest.checks, checksWarning: plan.pullRequest.checksWarning, conversation: plan.pullRequest.conversation } : null,
    contextPaths: plan.contextPaths, files: [], omissions: sources.gaps };
}

// Retain only cited source as evidence. Unchanged callers are valid evidence too.
export async function captureSourceEvidence(report, packet) {
  for (const finding of report.findings) for (const evidence of finding.evidence) {
    if (evidence.kind !== 'source' || packet.files.some(f => f.path === evidence.path && f.side === evidence.side && (f.sourceId ?? '') === (evidence.sourceId ?? ''))) continue;
    const path = sourcePath(evidence.path);
    const attached = evidence.sourceId ? packet.sources.find(s=>s.id===evidence.sourceId && s.available) : null;
    if(evidence.sourceId && !attached) throw new Error('Unavailable cited source');
    const repo = attached?.repo ?? packet.snapshot.repo;
    const revision = attached?.revision ?? (evidence.side === 'base' ? packet.snapshot.mergeBase : packet.snapshot.head);
    const tree = await git(repo, ['ls-tree', '-z', revision, '--', path]);
    const entry = tree.split('\0').find(line => line.endsWith('\t' + path));
    const [mode, type, oid] = (entry?.split('\t')[0] ?? '').split(' ');
    if (type !== 'blob' || !['100644', '100755'].includes(mode)) throw new Error('Source evidence is not a regular committed file');
    const text = requireSuccess(await command(['git', '--no-pager', '-C', repo, 'cat-file', 'blob', oid],
      { maxBytes: Infinity }), 'Read cited source').stdout;
    if (text.includes('\0')) throw new Error('Source evidence is binary');
    packet.files.push({ sourceId:evidence.sourceId ?? '', repository:attached?.repository ?? packet.snapshot.repo, path, side: evidence.side, revision, text });
  }
}

export async function isFresh(snap) {
  const current = await snapshot(snap.repo, snap.baseRef, snap.headRef);
  return current.base === snap.base && current.head === snap.head && current.mergeBase === snap.mergeBase &&
    JSON.stringify(current.paths) === JSON.stringify(snap.paths);
}
