import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { command, requireSuccess } from '../../review/process.mjs';
import { createPlan, validatePlan } from '../../review/plan.mjs';
import { git, packetFor } from '../../review/snapshot.mjs';
import { runReview, exitCode } from '../../review/run.mjs';
import { validateReviewer } from '../../review/report.mjs';
import { codexArgs, reviewWithCodex } from '../../review/reviewers/codex.mjs';
import { OpenELISEnvironment, workerName } from '../../review/environments/openelis.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'code-qa-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const repo = join(dir, 'repo'), output = join(dir, 'runs');
  await mkdir(repo);
  await git(repo, ['init', '-b', 'main']);
  await git(repo, ['config', 'user.name', 'Fixture']);
  await git(repo, ['config', 'user.email', 'fixture@example.invalid']);
  await writeFile(join(repo, 'value.js'), 'export const value = 1;\n');
  await writeFile(join(repo, 'obsolete.test.js'), '// Superseded responsibility\n');
  await git(repo, ['add', '.']);
  await git(repo, ['commit', '-m', 'base']);
  const base = (await git(repo, ['rev-parse', 'HEAD'])).trim();
  await writeFile(join(repo, 'value.js'), 'export const value = 2;\n');
  await unlink(join(repo, 'obsolete.test.js'));
  await git(repo, ['add', '-A']);
  await git(repo, ['commit', '-m', 'intentional cleanup']);
  return { repo, output, dir, base };
}
const planFor = (f, extra = {}) => createPlan({ repo: f.repo, base: f.base, head: 'HEAD', ...extra });
const cleanReport = head => ({ schemaVersion: 1, head, summary: 'Scoped source review completed.', coverage: 'complete', omissions: [], findings: [] });
const fakeReviewer = async (plan) => ({ report: cleanReport(plan.snapshot.head), usage: { input_tokens: 12, output_tokens: 9 } });
const ai = { rigor: 'standard', adapter: 'codex', model: 'explicit-test-model', billingMode: 'unknown' };

function fakeEnvironment(events, overrides = {}) {
  return () => ({
    async start() { events.push('start'); },
    async verify() { events.push('verify'); return { id: 'fixture', status: 'pass', executed: 1 }; },
    async collect() { events.push('collect'); },
    async cleanup() { events.push('cleanup'); return 'removed'; },
    ...overrides,
  });
}

test('mechanical CLI completes without any AI and allows approved test deletion', async t => {
  const f = await fixture(t), plan = await planFor(f);
  let calls = 0;
  const result = await runReview(plan, f.output, { reviewer: async () => { calls++; throw new Error('model must not run'); } });
  assert.equal(calls, 0);
  assert.equal(result.run.status, 'complete'); assert.equal(result.run.assessment, 'no_findings');
  assert.equal(result.run.usage.sessions, 0);
  const packet = JSON.parse(await readFile(join(result.directory, 'packet.json'), 'utf8'));
  assert.ok(packet.files.some(f => f.path === 'obsolete.test.js' && f.side === 'base'));
  assert.ok(!packet.files.some(f => f.path === 'obsolete.test.js' && f.side === 'head'));
  await assert.rejects(runReview(plan, f.output), /EEXIST/);
});

test('targeted review includes declared neighbors and limits its question', async t => {
  const f = await fixture(t), plan = await planFor(f, { application: 'targeted', question: 'Is value changed?', paths: ['value.js'], contextPaths: ['obsolete.test.js'] });
  const packet = await packetFor(plan);
  assert.deepEqual(packet.selectedPaths, ['value.js']);
  assert.equal(packet.question, 'Is value changed?');
  assert.ok(packet.files.some(f => f.path === 'obsolete.test.js'));
  await assert.rejects(planFor(f, { application: 'targeted' }), /question/);
  await assert.rejects(planFor(f, { paths: ['../secret'] }), /Invalid source path/);
});

test('ref movement after planning is superseded before any execution', async t => {
  const f = await fixture(t), plan = await planFor(f, ai);
  await git(f.repo, ['commit', '--allow-empty', '-m', 'new head']);
  const result = await runReview(plan, f.output, { reviewer: () => { throw new Error('must not call'); } });
  assert.equal(result.run.status, 'superseded'); assert.equal(exitCode(result.run), 3);
  assert.equal(result.run.usage.sessions, 0);
});

test('whitespace regression is a finding, not a runner crash or clean result', async t => {
  const f = await fixture(t);
  await writeFile(join(f.repo, 'value.js'), 'export const value = 2;   \n');
  await git(f.repo, ['add', '.']); await git(f.repo, ['commit', '-m', 'whitespace']);
  const result = await runReview(await planFor(f), f.output);
  assert.equal(result.run.status, 'complete'); assert.equal(result.run.assessment, 'findings');
  assert.equal(result.run.checks[0].status, 'fail');
});

test('unsupported paid limits, combinations and unknown rigor are rejected', async t => {
  const f = await fixture(t), plan = await planFor(f, ai);
  assert.throws(() => validatePlan({ ...plan, maxUsd: 1 }), /unsupported/);
  assert.throws(() => validatePlan({ ...plan, maxTokens: 100 }), /unsupported/);
  assert.throws(() => validatePlan({ ...plan, maxSessions: 2 }), /unsupported/);
  assert.throws(() => validatePlan({ ...plan, rigor: 'deep' }), /not yet implemented/);
  assert.throws(() => validatePlan({ ...plan, rigor: 'mechanical' }), /Mechanical/);
});

test('context omission cannot produce a clean AI review', async t => {
  const f = await fixture(t);
  await writeFile(join(f.repo, 'large.js'), 'x'.repeat(400));
  await git(f.repo, ['add', '.']); await git(f.repo, ['commit', '-m', 'large']);
  const result = await runReview(await planFor(f, { ...ai, maxContextBytes: 100 }), f.output, { reviewer: fakeReviewer });
  assert.equal(result.run.status, 'partial'); assert.equal(result.run.assessment, 'undetermined');
  assert.ok(result.run.reasons.some(r => r.includes('context limit')));
});

for (const failure of ['startup', 'verification', 'zero-tests', 'cancellation']) {
  test(`${failure} retains an incomplete result and still cleans its environment`, async t => {
    const f = await fixture(t), events = [], controller = new AbortController();
    const overrides = failure === 'startup' ? { async start() { events.push('start'); throw new Error('build failed'); } }
      : failure === 'verification' ? { async verify() { throw new Error('probe unavailable'); } }
      : failure === 'zero-tests' ? { async verify() { return { id: 'empty', status: 'pass', executed: 0 }; } }
      : { async start() { controller.abort(); const e = new Error('cancelled'); e.kind = 'cancelled'; throw e; } };
    const result = await runReview(await planFor(f, { environment: 'openelis' }), f.output,
      { signal: controller.signal, environmentFactory: fakeEnvironment(events, overrides) });
    assert.deepEqual(events.slice(-2), ['collect', 'cleanup']);
    assert.equal(result.run.cleanup, 'removed'); assert.notEqual(result.run.status, 'complete');
    assert.equal(result.run.assessment, 'undetermined');
    assert.ok(await readFile(join(result.directory, 'report.md'), 'utf8'));
  });
}

test('cleanup failure is visible and cannot yield no findings', async t => {
  const f = await fixture(t);
  const result = await runReview(await planFor(f, { environment: 'openelis' }), f.output, {
    environmentFactory: fakeEnvironment([], { async cleanup() { throw new Error('worker busy'); } }),
  });
  assert.equal(result.run.cleanup, 'failed'); assert.equal(result.run.status, 'partial');
  assert.equal(result.run.assessment, 'undetermined');
});

for (const invalid of ['missing', 'stale', 'invented']) {
  test(`invalid ${invalid} reviewer output never becomes a clean result`, async t => {
    const f = await fixture(t), plan = await planFor(f, ai);
    const report = cleanReport(plan.snapshot.head);
    if (invalid === 'missing') delete report.findings;
    if (invalid === 'stale') report.head = '0'.repeat(40);
    if (invalid === 'invented') report.findings.push({ title: 'Invented', consequence: 'Unsupported', owner: 'source', severity: 'high',
      evidence: [{ kind: 'source', path: 'value.js', side: 'head', line: 1, checkId: '', quote: 'not in source' }] });
    const result = await runReview(plan, f.output, { reviewer: async () => ({ report, usage: null }) });
    assert.equal(result.run.status, 'error'); assert.equal(result.run.assessment, 'undetermined');
  });
}

test('actual source evidence is preserved as reviewer judgment', async t => {
  const f = await fixture(t), plan = await planFor(f, ai), report = cleanReport(plan.snapshot.head);
  report.findings.push({ title: 'Changed value', consequence: 'Callers now receive 2', owner: 'value.js', severity: 'low',
    evidence: [{ kind: 'source', path: 'value.js', side: 'head', line: 1, checkId: '', quote: 'value = 2' }] });
  const result = await runReview(plan, f.output, { reviewer: async () => ({ report, usage: null }) });
  assert.equal(result.run.status, 'complete'); assert.equal(result.run.assessment, 'findings');
  assert.match(await readFile(join(result.directory, 'report.md'), 'utf8'), /not independent confirmation/);
});

test('command timeout and output limit are distinct incomplete outcomes', async () => {
  const timeout = await command([process.execPath, '-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 40 });
  assert.equal(timeout.timedOut, true);
  assert.throws(() => requireSuccess(timeout, 'test'), /timeout/);
  const overflow = await command([process.execPath, '-e', 'console.log("x".repeat(10000))'], { maxBytes: 10 });
  assert.equal(overflow.overflow, true);
  assert.throws(() => requireSuccess(overflow, 'test'), /output limit/);
});

test('Codex runs in packet-only mode and validates its completed-turn envelope', async t => {
  const f = await fixture(t), plan = await planFor(f, ai), packet = await packetFor(plan);
  const args = codexArgs(plan, '/isolated', '/schema', '/output');
  assert.ok(args.includes('--ignore-user-config')); assert.ok(args.includes('--ignore-rules'));
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(!args.some(a => a.includes('dangerously')));
  const dir = join(f.dir, 'codex'); await mkdir(dir);
  const result = await reviewWithCodex(plan, packet, [], dir, undefined, async argv => {
    await writeFile(argv[argv.indexOf('--output-last-message') + 1], JSON.stringify(cleanReport(plan.snapshot.head)));
    return { code: 0, stdout: JSON.stringify({ type: 'item.completed', item: { type: 'error', message: 'Optional tool disabled' } }) + '\n' + JSON.stringify({ type: 'turn.completed', usage: { output_tokens: 3 } }) + '\n' };
  });
  assert.equal(result.usage.output_tokens, 3);
  validateReviewer(result.report, packet, []);
});

test('Codex tool attempts, process failures and empty completion are rejected', async t => {
  const f = await fixture(t), plan = await planFor(f, ai), packet = await packetFor(plan);
  for (const [id, result] of Object.entries({ tool: { code: 0, stdout: '{"type":"item.completed","item":{"type":"command_execution"}}\n{"type":"turn.completed"}\n' },
    failure: { code: 1, stdout: '' }, empty: { code: 0, stdout: '' } })) {
    const dir = join(f.dir, id); await mkdir(dir);
    await assert.rejects(reviewWithCodex(plan, packet, [], dir, undefined, async () => result));
  }
});

test('isolated workers have distinct names and refuse an existing resource', async t => {
  const f = await fixture(t), plan = await planFor(f, { environment: 'openelis' }), second = await planFor(f, { environment: 'openelis' });
  assert.notEqual(workerName(plan.id), workerName(second.id));
  const environment = new OpenELISEnvironment(plan, f.dir, async () => ({ code: 0, stdout: JSON.stringify({ name: workerName(plan.id) }) }));
  await assert.rejects(environment.start(), /already exists/);
  assert.equal(environment.owned, false);
  assert.equal(await environment.cleanup(), 'not-created');
});

test('CLI writes a usable result from a persisted plan without model access', async t => {
  const f = await fixture(t), plan = join(f.dir, 'plan.json');
  requireSuccess(await command([process.execPath, join(root, 'review/cli.mjs'), 'plan', '--repo', f.repo, '--base', f.base, '--head', 'HEAD', '--out', plan]), 'plan');
  const result = requireSuccess(await command([process.execPath, join(root, 'review/cli.mjs'), 'run', '--plan', plan, '--out', f.output]), 'run');
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, 'complete');
  assert.equal(JSON.parse(await readFile(join(summary.directory, 'result.json'), 'utf8')).usage.sessions, 0);
});


test('changed plan inventory is rejected instead of silently dropping review scope', async t => {
  const f = await fixture(t), plan = await planFor(f);
  plan.snapshot.paths = [];
  const result = await runReview(plan, f.output);
  assert.equal(result.run.status, 'superseded');
});

test('process cancellation kills its child process group', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'code-qa-process-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const pidFile = join(dir, 'child.pid');
  const script = `const {spawn}=require('node:child_process');const fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});fs.writeFileSync(${JSON.stringify(pidFile)},String(c.pid));setInterval(()=>{},1000);`;
  const controller = new AbortController();
  const running = command([process.execPath, '-e', script], { signal: controller.signal, timeoutMs: 5000 });
  let pid;
  for (let i = 0; i < 100 && !pid; i++) {
    try { pid = Number(await readFile(pidFile, 'utf8')); } catch { await new Promise(resolve => setTimeout(resolve, 10)); }
  }
  controller.abort();
  const result = await running;
  assert.ok(pid, 'child started'); assert.equal(result.cancelled, true);
  assert.throws(() => process.kill(pid, 0), /ESRCH/);
});

test('generic installation carries the shared procedure with focused skills', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'code-qa-install-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  requireSuccess(await command([process.execPath, join(root, 'install.mjs'), '--target', dir]), 'install');
  const installed = join(dir, '.claude/skills');
  const common = await readFile(join(installed, 'review-change/SKILL.md'), 'utf8');
  assert.equal(common, await readFile(join(root, 'skills/review-change/SKILL.md'), 'utf8'));
  for (const skill of ['meaningful-test-coverage', 'simplicity-review', 'spec-code-alignment', 'cross-repo-companion-pr']) {
    const content = await readFile(join(installed, skill, 'SKILL.md'), 'utf8');
    const target = content.match(/\]\((\.\.\/review-change\/SKILL.md)\)/)[1];
    assert.equal(await readFile(join(installed, skill, target), 'utf8'), common);
  }
});

test('cancellation releases pipes held by an escaped descendant so cleanup can run', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'code-qa-escaped-process-'));
  const pidFile = join(dir, 'escaped.pid');
  let escapedPid;
  t.after(async () => {
    if (escapedPid) { try { process.kill(-escapedPid, 'SIGKILL'); } catch {} }
    await rm(dir, { recursive: true, force: true });
  });
  // Like a daemonized SSH master, this descendant has its own group but inherits
  // the parent's output streams. Ordinary group termination cannot close them.
  const script = `const {spawn}=require('node:child_process');const fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit',detached:true});fs.writeFileSync(${JSON.stringify(pidFile)},String(c.pid));setInterval(()=>{},1000);`;
  const controller = new AbortController();
  const running = command([process.execPath, '-e', script], { signal: controller.signal, timeoutMs: 10_000 });
  for (let i = 0; i < 100 && !escapedPid; i++) {
    try { escapedPid = Number(await readFile(pidFile, 'utf8')); } catch { await new Promise(resolve => setTimeout(resolve, 10)); }
  }
  assert.ok(escapedPid, 'escaped child started');
  controller.abort();
  let timer;
  try {
    const result = await Promise.race([running, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cancellation never released inherited pipes')), 4000); })]);
    assert.equal(result.cancelled, true);
  } finally { clearTimeout(timer); }
});
