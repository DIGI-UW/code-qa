import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { command, requireSuccess } from '../process.mjs';
import { validateCheckResult } from '../checks.mjs';

export const workerName = id => {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid worker id');
  return `code-qa-${id}`;
};

export class OpenELISEnvironment {
  constructor(plan, directory, execute = command) {
    this.plan = plan; this.directory = directory; this.execute = execute;
    this.name = workerName(plan.id); this.owned = false;
  }
  async call(label, argv, options = {}) {
    const result = await this.execute(argv, { log: join(this.directory, `${label}.log`), ...options });
    return requireSuccess(result, label);
  }
  async start(signal) {
    const deadline = Date.now() + this.plan.startupSeconds * 1000;
    const remaining = () => Math.max(1, deadline - Date.now());
    const existing = await this.execute(['limactl', 'list', '--json']);
    requireSuccess(existing, 'Inspect workers');
    if (existing.stdout.split('\n').filter(Boolean).some(line => JSON.parse(line).name === this.name)) throw new Error('Worker name already exists; refusing to reuse or delete it');
    this.owned = true;
    const config = fileURLToPath(new URL('./openelis.lima.yaml', import.meta.url));
    const args = ['limactl', 'start', '--tty=false', '--name', this.name, '--mount-none', '--timeout', `${this.plan.startupSeconds}s`];
    if (process.platform === 'darwin') args.push('--vm-type', 'vz', '--rosetta');
    await this.call('worker-start', [...args, config], { signal, timeoutMs: remaining(), maxBytes: 16 * 1024 * 1024 });
    const setup = await readFile(new URL('./openelis-start.sh', import.meta.url), 'utf8');
    await this.call('openelis-start', ['limactl', 'shell', '--workdir', '/', this.name, 'sg', 'docker', '-c', `bash -s -- ${this.plan.snapshot.head}`],
      { input: setup, signal, timeoutMs: remaining(), maxBytes: 32 * 1024 * 1024 });
  }
  async verify(signal) {
    const script = await readFile(new URL('./openelis-smoke.py', import.meta.url), 'utf8');
    const result = await this.call('openelis-smoke', ['limactl', 'shell', '--workdir', '/', this.name, 'sg', 'docker', '-c', 'python3 -'],
      { input: script, signal, timeoutMs: 120_000 });
    const report = JSON.parse(result.stdout.trim());
    if (report.head !== this.plan.snapshot.head || !Array.isArray(report.assertions) || report.assertions.length < 3 ||
        report.assertions.some(a => typeof a.name !== 'string' || typeof a.passed !== 'boolean')) throw new Error('Invalid OpenELIS assertion evidence');
    return { id: 'openelis-authentication-smoke', status: report.assertions.every(a => a.passed) ? 'pass' : 'fail',
      executed: report.assertions.length, assertions: report.assertions, head: report.head, endpoints: report.endpoints };
  }
  async runCheck(check, signal) {
    const script = await readFile(new URL('./openelis-check.py', import.meta.url), 'utf8');
    const payload = Buffer.from(JSON.stringify({ check, head: this.plan.snapshot.head })).toString('base64');
    const result = await this.call('check-' + check.id,
      ['limactl', 'shell', '--workdir', '/', this.name, 'sg', 'docker', '-c', 'python3 - ' + payload],
      { input: script, signal, timeoutMs: (check.timeoutSeconds + 30) * 1000, maxBytes: 16 * 1024 * 1024 });
    return validateCheckResult(JSON.parse(result.stdout.trim()), check, this.plan.snapshot.head);
  }
  async collect() {
    if (!this.owned) return;
    const script = 'cd "$HOME/review/source" || exit\ngit rev-parse HEAD\ngit submodule status --recursive\ngit status --short\ndocker ps --format "{{.ID}} {{.Image}} {{.Status}}"\ndocker image ls --digests\nscripts/dev-stack logs\n';
    await this.call('openelis-evidence', ['limactl', 'shell', '--workdir', '/', this.name, 'sg', 'docker', '-c', 'bash -s'], { input: script, timeoutMs: 60_000, maxBytes: 32 * 1024 * 1024 });
  }
  async cleanup() {
    if (!this.owned) return 'not-created';
    // The entire worker belongs to this run. VM deletion also catches orphaned child processes.
    const list = requireSuccess(await this.execute(['limactl', 'list', '--json']), 'Inspect cleanup worker');
    if (!list.stdout.split('\n').filter(Boolean).some(line => JSON.parse(line).name === this.name)) return 'removed';
    await this.call(`worker-delete-${Date.now()}`, ['limactl', 'delete', '--force', this.name], { timeoutMs: 120_000 });
    return 'removed';
  }
}
