import {sourcePath} from './snapshot.mjs';

export function validateProbes(probes, checks) {
  if (!Array.isArray(probes) || probes.length > 20) throw new Error('At most 20 predeclared probes');
  const ids=new Set();
  for (const p of probes) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(p.id) || ids.has(p.id)) throw new Error('Unique probe ID required');
    ids.add(p.id);
    if (typeof p.behavior!=='string' || !p.behavior.trim()) throw new Error('Probe needs a behavior');
    if (p.inapplicableReason) {
      if (typeof p.inapplicableReason!=='string' || !p.inapplicableReason.trim()) throw new Error('Invalid applicability reason');
      continue;
    }
    const check=checks.find(c=>c.id===p.checkId);
    if (!check || check.kind==='command') throw new Error('Probe needs a test check');
    if (!Array.isArray(p.fixedTests) || !p.fixedTests.length) throw new Error('Probe must declare fixed tests');
    p.fixedTests.forEach(sourcePath);
    sourcePath(p.path);
    if (p.fixedTests.includes(p.path)) throw new Error('Cannot mutate fixed tests');
    for (const k of ['before','after','expectedCase','expectedFailure']) if(typeof p[k]!=='string' || !p[k].trim()) throw new Error('Probe needs '+k);
    if (p.before===p.after) throw new Error('Probe does not change production');
  }
  return probes;
}
export function validateProbeResult(result, probe, head) {
  if (result.id!==probe.id || result.head!==head) throw new Error('Probe evidence identity mismatch');
  if (!['detected','survived','uncovered','invalid','setup-error','timeout','inapplicable'].includes(result.outcome)) throw new Error('Unknown probe outcome');
  if (result.outcome==='inapplicable' && result.reason!==probe.inapplicableReason) throw new Error('Unapproved inapplicable probe');
  if (result.outcome==='detected') {
    const {baseline,mutant,restored}=result;
    if(baseline?.status!=='pass' || restored?.status!=='pass' || mutant?.outcome!=='assertion-failure' || !result.fixedTestsPreserved ||
      !mutant.assertions.some(a=>a.outcome==='assertion-failure' && a.name===probe.expectedCase && a.detail.includes(probe.expectedFailure))) throw new Error('No intended assertion detection');
  }
  return result;
}
