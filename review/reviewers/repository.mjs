import { join } from 'node:path';
import { command, requireSuccess } from '../process.mjs';

// A fresh bare repository exposes committed source, not the operator's dirty worktree,
// Git configuration, hooks or credentials. No checkout means PR-owned agent/config
// files and symlinks cannot become active filesystem configuration.
export async function prepareRepository(snapshot, directory, signal) {
  const path = join(directory, 'repository.git');
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_') && !['GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL', 'GIT_TERMINAL_PROMPT'].includes(key)) delete env[key];
  const git = async args => requireSuccess(await command(['git', '-c', 'core.hooksPath=/dev/null', ...args],
    { env, signal, timeoutMs: 120_000 }), 'Prepare reviewer repository').stdout;
  await git(['init', '--bare', '--template=', path]);
  await git(['-C', path, '-c', 'protocol.file.allow=always', 'fetch', '--no-tags', '--no-recurse-submodules', '--depth=1',
    snapshot.repo, ...new Set([snapshot.mergeBase, snapshot.base, snapshot.head])]);
  await git(['-C', path, 'update-ref', 'refs/heads/review-base', snapshot.mergeBase]);
  await git(['-C', path, 'update-ref', 'refs/heads/review-head', snapshot.head]);
  return path;
}
