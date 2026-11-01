import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { command, requireSuccess } from '../process.mjs';

// A fresh bare repository exposes committed source, not the operator's dirty worktree,
// Git configuration, hooks or credentials. No checkout means PR-owned agent/config
// files and symlinks cannot become active filesystem configuration.
export async function prepareRepository(snapshot, directory, signal, historyDepth = 1) {
  const path = join(directory, 'repository.git');
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_') && !['GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL', 'GIT_TERMINAL_PROMPT', 'GIT_NO_LAZY_FETCH'].includes(key)) delete env[key];
  const safeDiagnostic = text => text.replace(/(https?:\/\/)[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1?[redacted]');
  const fail = async error => {
    // Git diagnostics can contain credential-bearing remote URLs. Keep useful
    // failure context, never URL userinfo or query parameters, in durable reports.
    error.message = safeDiagnostic(error.message);
    await writeFile(join(directory, 'repository-error.txt'), error.message + '\n', {mode:0o600});
    throw error;
  };
  const git = async (stage, args) => {
    const result = await command(['git', '-c', 'core.hooksPath=/dev/null', ...args], {env, signal, timeoutMs:120_000});
    try { return requireSuccess(result, 'Prepare reviewer repository (' + stage + ')').stdout; }
    catch (error) { error.message += result.stderr.trim() ? ': ' + safeDiagnostic(result.stderr.trim()).slice(-4000) : ''; return fail(error); }
  };
  const revisions = [...new Set([snapshot.mergeBase, snapshot.base, snapshot.head])];
  // Probe the pinned trees without triggering a promisor remote fetch. Source
  // acquisition belongs to the operator, outside the isolated reviewer.
  const objects = await git('source preflight', ['-C', snapshot.repo, 'rev-list', '--objects', '--no-object-names', '--missing=print', '--no-walk=unsorted', ...revisions, '--']);
  const missing = objects.split('\n').filter(line => line.startsWith('?'));
  if (missing.length) {
    const error = new Error(`Prepare reviewer repository: ${missing.length} missing Git objects in ${snapshot.repo}. Materialize the pinned source trees in the source checkout, then create a new run. No reviewer was started. Missing objects: ${missing.slice(0,10).join(', ')}`);
    error.kind = 'partial'; await fail(error);
  }
  await git('initialize snapshot', ['init', '--bare', '--template=', path]);
  await git('fetch pinned source', ['-C', path, '-c', 'protocol.file.allow=always', 'fetch', '--no-tags', '--no-recurse-submodules', '--depth='+historyDepth, snapshot.repo, ...revisions]);
  await git('record base', ['-C', path, 'update-ref', 'refs/heads/review-base', snapshot.mergeBase]);
  await git('record head', ['-C', path, 'update-ref', 'refs/heads/review-head', snapshot.head]);
  return path;
}
