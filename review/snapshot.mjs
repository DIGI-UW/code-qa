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
  const selected = [...new Set([...changed, ...plan.contextPaths])];
  const files = [], omissions = [];
  let remaining = plan.maxContextBytes;
  for (const path of selected) {
    sourcePath(path);
    for (const side of ['base', 'head']) {
      const sha = side === 'base' ? snap.mergeBase : snap.head;
      const tree = await git(snap.repo, ['ls-tree', '-z', sha, '--', path]);
      const entry = tree.split('\0').find(line => line.endsWith('\t' + path));
      if (!entry) continue; // A new or deleted file legitimately has only one side.
      const [mode, type, oid] = entry.split('\t')[0].split(' ');
      if (type !== 'blob' || mode === '120000') { omissions.push(`${side}:${path}: non-regular source`); continue; }
      const size = Number((await git(snap.repo, ['cat-file', '-s', oid])).trim());
      if (size > remaining) { omissions.push(`${side}:${path}: context limit`); continue; }
      const text = await git(snap.repo, ['cat-file', 'blob', oid]);
      if (text.includes('\0')) { omissions.push(`${side}:${path}: binary`); continue; }
      remaining -= Buffer.byteLength(text);
      files.push({ path, side, revision: sha, text });
    }
  }
  return { schemaVersion: 1, snapshot: snap, application: plan.application, question: plan.question,
    purpose: plan.purpose, requirements: plan.requirements, selectedPaths: changed,
    contextPaths: plan.contextPaths, files, omissions };
}

export async function isFresh(snap) {
  const current = await snapshot(snap.repo, snap.baseRef, snap.headRef);
  return current.base === snap.base && current.head === snap.head && current.mergeBase === snap.mergeBase &&
    JSON.stringify(current.paths) === JSON.stringify(snap.paths);
}
