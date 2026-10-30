import {assessRuntime,assessScenarios} from './runtime.mjs';
import {assessAcceptance} from './acceptance.mjs';
import {persistArtifacts,captureDesigns} from './artifacts.mjs';
import { validateProbeResult } from './probes.mjs';
import { identifyFindings, reconcileHistory } from './history.mjs';
import { decisionGaps } from './decisions.mjs';
import { ContainerEnvironment } from './environments/container.mjs';
import { mkdir, writeFile,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { command, requireSuccess } from './process.mjs';
import { packetFor, isFresh, captureSourceEvidence } from './snapshot.mjs';
import { validatePlan, runDirectory } from './plan.mjs';
import { renderReport, validateReviewer, validateSchema, reviewerSchema, coverageGaps, verificationGaps, actionableFindings } from './report.mjs';
import { reviewerAdapter, capabilityGaps } from './reviewers/index.mjs';
import { isPRFresh } from './github.mjs';
import { validateCheckResult } from './checks.mjs';
import { OpenELISEnvironment } from './environments/openelis.mjs';

export async function runReview(plan, outputRoot, { signal, reviewer,
  environmentFactory = (p, d) => p.environment === 'container' ? new ContainerEnvironment(p, d) : new OpenELISEnvironment(p, d), onProgress = () => {}, freshness = isPRFresh } = {}) {
  validatePlan(plan);
  const directory = runDirectory(outputRoot, plan);
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  await mkdir(directory, { mode: 0o700 }); // Never overwrite a prior run/evidence.
  const run = { schemaVersion: 1, harnessVersion: '0.5.0', nodeVersion: process.version, plan, status: 'partial', assessment: 'undetermined', phase: 'prepare',
    checks: [], probes: [], artifacts:[], designs:[], reasons: [], cleanup: 'not-needed', usage: { sessions: 0, reported: null }, reviewer: null };
  const save = async () => {
    await writeFile(join(directory, 'result.json'), JSON.stringify(run, null, 2) + '\n', { mode: 0o600 });
    await writeFile(join(directory, 'report.md'), renderReport(run), { mode: 0o600 });
  };
  const phase = async name => { run.phase = name; onProgress(name); await save(); };
  const failed = error => { run.status = error.kind ?? 'error'; run.reasons.push(error.message); };
  await writeFile(join(directory, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { mode: 0o600 });
  let packet, environment;
  try {
    if (!await isFresh(plan.snapshot) || !await freshness(plan)) { const e = new Error('Base or head changed after planning'); e.kind = 'superseded'; throw e; }
    const unsupported = capabilityGaps(plan);
    if (unsupported.length) {
      const error = new Error('Required evidence is not implemented: ' + unsupported.join(', ') + '. No environment or reviewer was started.');
      error.kind = 'partial'; throw error;
    }
    packet = await packetFor(plan);
    run.designs=await captureDesigns(plan.designs ?? [],directory);
    await writeFile(join(directory, 'packet.json'), JSON.stringify(packet, null, 2) + '\n', { mode: 0o600 });
    await phase('mechanical');
    const diff = await command(['git', '--no-pager', '--literal-pathspecs', '-C', plan.snapshot.repo, 'diff', '--no-ext-diff', '--no-textconv', '--check',
      plan.snapshot.mergeBase, plan.snapshot.head, '--', ...packet.selectedPaths], { signal, log: join(directory, 'whitespace.log') });
    if (![0, 2].includes(diff.code) || diff.timedOut || diff.cancelled || diff.overflow || diff.spawnError) requireSuccess(diff, 'Whitespace check');
    run.checks.push({ id: 'whitespace', status: diff.code === 0 ? 'pass' : 'fail', evidence: diff.stdout.trim(), paths: packet.selectedPaths });
    if (plan.environment !== 'none') {
      environment = environmentFactory(plan, directory);
      {
        await phase('environment-start');
        await environment.start(signal);
        await phase('environment-verify');
        const checked = await environment.verify(signal);
        if (!Number.isInteger(checked.executed) || checked.executed < 1 || !['pass', 'fail'].includes(checked.status)) throw new Error('No valid executed environment assertions');
        run.checks.push(checked);
        for (const spec of plan.checks) {
          await phase('check-' + spec.id);
          const result = validateCheckResult(await environment.runCheck(spec, signal), spec, plan.snapshot.head);
          run.artifacts.push(...await persistArtifacts(result,directory,plan.snapshot.head));
          run.reasons.push(...(result.artifactGaps ?? []));
          if(result.artifacts)result.artifacts=result.artifacts.map(({base64,...a})=>a);
          run.checks.push(result);
        }
        for (const probe of plan.probes ?? []) {
          await phase('probe-' + probe.id);
          const result = validateProbeResult(await environment.runProbe(probe, signal), probe, plan.snapshot.head);
          run.probes.push(result);
          if (!['detected','inapplicable'].includes(result.outcome)) run.reasons.push('Probe ' + probe.id + ': ' + result.outcome);
        }
      }
    }
    if(plan.requiredEvidence.includes('runtime-identity')) {
      if(environment.runtimeIdentity)run.runtime=await environment.runtimeIdentity(signal);
      else {const evidence=run.artifacts.find(a=>a.kind==='runtime' && a.checkId===plan.runtimeCheckId);if(evidence)run.runtime=JSON.parse(await readFile(evidence.path,'utf8'));}
      const assessed=assessRuntime(run.runtime,plan.snapshot.head);run.runtimeAssessment=assessed;run.reasons.push(...assessed.reasons);
      run.reasons.push(...assessScenarios(plan.scenarios,run.checks));
    }
    if (signal?.aborted) { const e = new Error('Run cancelled'); e.kind = 'cancelled'; throw e; }
    if (plan.adapter !== 'none') {
      let reviewed;
      const started=Date.now();
      const requested=new Set();
      for(let round=0;round<plan.maxSessions;round++) {
        await phase('reviewer-' + round);
        const seconds=Math.ceil(plan.reviewSeconds-(Date.now()-started)/1000);
        if(seconds<1) { const e=new Error('Review time allowance exhausted');e.kind='partial';throw e; }
        const roundDirectory=round===0 ? directory : join(directory,'round-'+round);
        if(round) await mkdir(roundDirectory,{mode:0o700});
        run.usage.sessions++;
        reviewed = await (reviewer ?? reviewerAdapter(plan.adapter).review)({...plan,reviewSeconds:seconds},
          {...packet,probes:run.probes,runtime:run.runtime,artifacts:run.artifacts,designs:run.designs,workflows:plan.workflows ?? [],scenarios:plan.scenarios ?? [],previousAssessment:reviewed?.report ?? null,experimentCatalog:(plan.experiments ?? []).map(c=>({id:c.id,kind:c.kind,argv:c.argv}))},run.checks,roundDirectory,signal);
        validateSchema(reviewed.report,reviewerSchema);
        run.usage.rounds ??= [];run.usage.rounds.push(reviewed.usage ?? null);
        const requests=reviewed.report.requestedChecks ?? [];
        if(!requests.length) break;
        if(round+1>=plan.maxSessions) {run.reasons.push('Requested verification exceeds the authorized review rounds');break;}
        for(const request of requests) {
          const spec=(plan.experiments ?? []).find(c=>c.id===request.id);
          if(!spec || !environment || requested.has(spec.id) || !request.reason.trim() || !request.falsifies.trim()) {
            run.reasons.push('Unavailable or repeated requested experiment: '+request.id);continue;
          }
          requested.add(spec.id);
          await phase('experiment-'+spec.id);
          const result=validateCheckResult(await environment.runCheck(spec,signal),spec,plan.snapshot.head);
          run.artifacts.push(...await persistArtifacts(result,directory,plan.snapshot.head));run.reasons.push(...(result.artifactGaps ?? []));
          if(result.artifacts)result.artifacts=result.artifacts.map(({base64,...a})=>a);
          run.checks.push(result);
        }
      }
      validateSchema(reviewed.report, reviewerSchema);
      await captureSourceEvidence(reviewed.report, packet);
      await writeFile(join(directory, 'packet.json'), JSON.stringify(packet, null, 2) + '\n', { mode: 0o600 });
      if (reviewed.report.priorFindings?.length) {
        const evidenceReport = { ...reviewed.report, findings: reviewed.report.priorFindings.filter(d => d.evidence.length).map(d => ({ title: d.id, consequence: d.reason, owner: 'history', severity: 'low', disposition: 'suggestion', counterevidence: d.reason, alternative: '', evidence: d.evidence })) };
        await captureSourceEvidence(evidenceReport, packet);
        validateReviewer(evidenceReport, packet, run.checks);
      }
      run.reviewer = validateReviewer(reviewed.report, packet, run.checks); run.usage.reported = Object.fromEntries([...new Set(run.usage.rounds.flatMap(r=>Object.keys(r??{})))].filter(k=>run.usage.rounds.every(r=>typeof r?.[k]==='number')).map(k=>[k,run.usage.rounds.reduce((sum,r)=>sum+r[k],0)]));
      const repository = plan.pullRequest?.repository ?? plan.snapshot.repo;
      run.findings = identifyFindings(run.reviewer, repository, plan.snapshot.head);
      run.history = reconcileHistory(plan.history, run.reviewer, run.findings, repository, plan.snapshot.head);
      await writeFile(join(directory, 'history.json'), JSON.stringify(run.history, null, 2) + '\n', {mode:0o600});
      run.reasons.push(...run.history.rounds.filter(r => r.head === plan.snapshot.head && r.status === 'unverified').map(r => 'Prior finding unverified: ' + r.id));
      run.reasons.push(...decisionGaps(plan.decisions ?? []), ...(plan.pullRequest?.conversation?.gaps ?? []));
      await writeFile(join(directory,'packet.json'),JSON.stringify(packet,null,2)+'\n',{mode:0o600});
      if(plan.requiredEvidence.includes('product-acceptance')) {run.acceptance=assessAcceptance(plan.workflows,run.reviewer,run.checks,run.artifacts,run.designs);run.reasons.push(...run.acceptance.gaps);}
      run.inspection = reviewed.inspection ?? null;
      run.adapterDiagnostics = reviewed.diagnostics ?? [];
      run.reasons.push(...coverageGaps(run.reviewer),...verificationGaps(run.reviewer,plan,run.checks,run.probes));
      if (run.reviewer.coverage === 'partial' || run.reviewer.omissions.length) run.reasons.push(...run.reviewer.omissions, 'Reviewer coverage is partial');
    }
    if (!await isFresh(plan.snapshot) || !await freshness(plan)) { const e = new Error('Base or head changed during execution; retained as historical evidence'); e.kind = 'superseded'; throw e; }
    if (plan.adapter !== 'none') run.reasons.push(...packet.omissions);
    run.reasons.push(...run.checks.filter(c=>c.status==='error').map(c=>'Check '+c.id+': '+c.outcome));
    run.status = run.reasons.length || run.cleanup === 'failed' ? 'partial' : 'complete';
    const hasFindings = Boolean(run.acceptance?.deviations.length) || run.runtimeAssessment?.status==='fail' || run.checks.some(c => c.status === 'fail') || Boolean(actionableFindings(run.reviewer).length);
    run.assessment = hasFindings ? 'findings' : run.status === 'complete' ? 'no_findings' : 'undetermined';
  } catch (error) { failed(error); if (run.checks.some(c => c.status === 'fail')) run.assessment = 'findings'; }
  if(environment) {
    run.phase='environment-cleanup';onProgress(run.phase);
    try {await environment.collect();} catch(error) {run.reasons.push('Evidence collection: '+error.message);}
    try {run.cleanup=await environment.cleanup();} catch(error) {run.cleanup='failed';run.reasons.push('Cleanup: '+error.message);}
    if(run.status==='complete' && run.reasons.length) {run.status='partial';if(run.assessment==='no_findings')run.assessment='undetermined';}
  }
  run.phase = 'finished'; run.finishedAt = new Date().toISOString();
  await save();
  return { directory, run };
}

export const exitCode = run => run.status === 'complete' ? 0 : ['cancelled', 'superseded'].includes(run.status) ? 3 : 2;
