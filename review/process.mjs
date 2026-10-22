import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';

// Never pass PR text through a host shell. Each invocation owns its process group.
export async function command(argv, { cwd, env = process.env, input, timeoutMs = 60_000,
  signal, log, maxBytes = 4 * 1024 * 1024 } = {}) {
  if (signal?.aborted) return { code: null, cancelled: true, stdout: '', stderr: '', elapsedMs: 0 };
  const started = Date.now();
  let file;
  if (log) {
    await mkdir(dirname(log), { recursive: true, mode: 0o700 });
    file = await open(log, 'wx', 0o600);
    await file.write(`${JSON.stringify({ argv, cwd, started: new Date(started).toISOString() })}\n`);
  }
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), { cwd, env, detached: process.platform !== 'win32', stdio: 'pipe' });
    let stdout = '', stderr = '', bytes = 0, timedOut = false, cancelled = false, overflow = false, spawnError, writeError;
    let killTimer;
    const kill = (sig) => {
      try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, sig); } catch { /* Already exited. */ }
    };
    const stop = () => {
      kill('SIGTERM');
      killTimer ??= setTimeout(() => {
        kill('SIGKILL');
        // An escaped descendant (for example an SSH control master) can keep the
        // pipes open after its parent exits. Release them so VM cleanup can run.
        child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
      }, 1000);
    };
    const abort = () => { cancelled = true; stop(); };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    const chunks = [];
    const capture = (which, data) => {
      bytes += data.length;
      if (bytes > maxBytes) { overflow = true; stop(); return; }
      if (which === 'stdout') stdout += data.toString(); else stderr += data.toString();
      if (file) chunks.push(file.write(data).catch(error => { writeError = error.message; stop(); }));
    };
    child.stdout.on('data', data => capture('stdout', data));
    child.stderr.on('data', data => capture('stderr', data));
    child.on('error', error => { spawnError = error.message; });
    child.stdin.on('error', () => {}); // A process may exit before consuming its input.
    child.stdin.end(input);
    child.on('close', async (code) => {
      clearTimeout(timer); clearTimeout(killTimer);
      signal?.removeEventListener('abort', abort);
      await Promise.allSettled(chunks);
      await file?.close().catch(error => { writeError = error.message; });
      resolve({ code, stdout, stderr, timedOut, cancelled, overflow, spawnError: spawnError || writeError, elapsedMs: Date.now() - started });
    });
  });
}

export function requireSuccess(result, label) {
  if (result.code === 0 && !result.timedOut && !result.cancelled && !result.overflow && !result.spawnError) return result;
  const reason = result.cancelled ? 'cancelled' : result.timedOut ? 'timeout' : result.overflow ? 'output limit' : result.spawnError || `exit ${result.code}`;
  const error = new Error(`${label}: ${reason}`);
  error.kind = result.cancelled ? 'cancelled' : result.timedOut ? 'partial' : 'error';
  throw error;
}
