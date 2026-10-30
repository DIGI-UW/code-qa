import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { command, requireSuccess } from './process.mjs';
import { packetFor, isFresh, captureSourceEvidence } from './snapshot.mjs';
import { validatePlan, runDirectory } from './plan.mjs';
import { renderReport, validateReviewer, validateSchema, reviewerSchema } from './report.mjs';
import { reviewWithCodex } from './reviewers/codex.mjs';
import { isPRFresh } from './github.mjs';
import { validateCheckResult } from './checks.mjs';
import { OpenELISEnvironment } from './environments/openelis.mjs';

export async function runReview(plan, outputRoot, { signal, reviewer = reviewWithCodex,
  environmentFactory = (p, d) => new OpenELISEnvironment(p, d), onProgress = () => {}, freshness = isPRFresh } = {}) {
  validatePlan(plan);
  const directory = runDirectory(outputRoot, plan);
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  await mkdir(directory, { mode: 0o700 }); // Never overwrite a prior run/evidence.
  const run = { schemaVersion: 1, harnessVersion: '0.3.0', nodeVersion: process.version, plan, status: 'partial', assessment: 'undetermined', phase: 'prepare',
    checks: [], reasons: [], cleanup: 'not-needed', usage: { sessions: 0, reported: null }, reviewer: null };
  const save = async () => {
    await writeFile(join(directory, 'result.json'), JSON.stringify(run, null, 2) + '\n', { mode: 0o600 });
    await writeFile(join(directory, 'report.md'), renderReport(run), { mode: 0o600 });
  };
  const phase = async name => { run.phase = name; onProgress(name); await save(); };
  const failed = error => { run.status = error.kind ?? 'error'; run.reasons.push(error.message); };
  await writeFile(join(directory, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { mode: 0o600 });
  let packet;
  try {
    if (!await isFresh(plan.snapshot) || !await freshness(plan)) { const e = new Error('Base or head changed after planning'); e.kind = 'superseded'; throw e; }
    packet = await packetFor(plan);
    await writeFile(join(directory, 'packet.json'), JSON.stringify(packet, null, 2) + '\n', { mode: 0o600 });
    await phase('mechanical');
    const diff = await command(['git', '--no-pager', '--literal-pathspecs', '-C', plan.snapshot.repo, 'diff', '--no-ext-diff', '--no-textconv', '--check',
      plan.snapshot.mergeBase, plan.snapshot.head, '--', ...packet.selectedPaths], { signal, log: join(directory, 'whitespace.log') });
    if (![0, 2].includes(diff.code) || diff.timedOut || diff.cancelled || diff.overflow || diff.spawnError) requireSuccess(diff, 'Whitespace check');
    run.checks.push({ id: 'whitespace', status: diff.code === 0 ? 'pass' : 'fail', evidence: diff.stdout.trim(), paths: packet.selectedPaths });
    if (plan.environment === 'openelis') {
      const environment = environmentFactory(plan, directory);
      try {
        await phase('environment-start');
        await environment.start(signal);
        await phase('environment-verify');
        const checked = await environment.verify(signal);
        if (!Number.isInteger(checked.executed) || checked.executed < 1 || !['pass', 'fail'].includes(checked.status)) throw new Error('No valid executed environment assertions');
        run.checks.push(checked);
        for (const spec of plan.checks) {
          await phase('check-' + spec.id);
          const result = validateCheckResult(await environment.runCheck(spec, signal), spec, plan.snapshot.head);
          run.checks.push(result);
        }
      } finally {
        run.phase = 'environment-cleanup'; onProgress(run.phase);
        try { await save(); } catch (error) { run.reasons.push(`State recording: ${error.message}`); }
        try { await environment.collect(); } catch (error) { run.reasons.push(`Evidence collection: ${error.message}`); }
        try { run.cleanup = await environment.cleanup(); }
        catch (error) { run.cleanup = 'failed'; run.reasons.push(`Cleanup: ${error.message}`); }
      }
    }
    if (signal?.aborted) { const e = new Error('Run cancelled'); e.kind = 'cancelled'; throw e; }
    if (plan.adapter === 'codex') {
      await phase('reviewer');
      run.usage.sessions = 1;
      const reviewed = await reviewer(plan, packet, run.checks, directory, signal);
      validateSchema(reviewed.report, reviewerSchema);
      await captureSourceEvidence(reviewed.report, packet);
      await writeFile(join(directory, 'packet.json'), JSON.stringify(packet, null, 2) + '\n', { mode: 0o600 });
      run.reviewer = validateReviewer(reviewed.report, packet, run.checks); run.usage.reported = reviewed.usage;
      run.inspection = reviewed.inspection ?? null;
      run.adapterDiagnostics = reviewed.diagnostics ?? [];
      if (run.reviewer.coverage === 'partial' || run.reviewer.omissions.length) run.reasons.push(...run.reviewer.omissions, 'Reviewer coverage is partial');
    }
    if (!await isFresh(plan.snapshot) || !await freshness(plan)) { const e = new Error('Base or head changed during execution; retained as historical evidence'); e.kind = 'superseded'; throw e; }
    if (plan.adapter !== 'none') run.reasons.push(...packet.omissions);
    run.status = run.reasons.length || run.cleanup === 'failed' ? 'partial' : 'complete';
    const hasFindings = run.checks.some(c => c.status === 'fail') || Boolean(run.reviewer?.findings.length);
    run.assessment = hasFindings ? 'findings' : run.status === 'complete' ? 'no_findings' : 'undetermined';
  } catch (error) { failed(error); if (run.checks.some(c => c.status === 'fail')) run.assessment = 'findings'; }
  run.phase = 'finished'; run.finishedAt = new Date().toISOString();
  await save();
  return { directory, run };
}

export const exitCode = run => run.status === 'complete' ? 0 : ['cancelled', 'superseded'].includes(run.status) ? 3 : 2;
