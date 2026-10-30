import { createHash } from 'node:crypto';
import { SHA } from './snapshot.mjs';

// IDs are private report identities, never application acceptance gates.
export function identifyFindings(report, repository, head) {
  return report.findings.map(f => ({ ...f, id: createHash('sha256').update(JSON.stringify([
    repository, f.owner, f.title, f.evidence.map(e => [e.kind, e.path, e.checkId]),
  ])).digest('hex').slice(0, 24), originalHead: head }));
}
export function validateHistory(history) {
  if (history === null) return null;
  if (history.schemaVersion !== 1 || !history.repository || !SHA.test(history.head) || !Array.isArray(history.findings)) throw new Error('Invalid prior review history');
  const ids = new Set();
  for (const f of history.findings) {
    if (!/^[a-f0-9]{24}$/.test(f.id) || ids.has(f.id) || !SHA.test(f.originalHead) || !f.title || !f.evidence?.length) throw new Error('Invalid prior finding');
    ids.add(f.id);
  }
  return history;
}
export function reconcileHistory(prior, report, current, repository, head) {
  const dispositions = report.priorFindings ?? [];
  if (!prior) {
    if (dispositions.length) throw new Error('Disposition refers to absent history');
    return { schemaVersion: 1, repository, head, findings: current, rounds: [] };
  }
  if (prior.repository !== repository) throw new Error('History repository mismatch');
  const seen = new Set();
  const rounds = dispositions.map(d => {
    const original = prior.findings.find(f => f.id === d.id);
    if (!original || seen.has(d.id) || !d.reason.trim()) throw new Error('Invalid prior finding disposition');
    seen.add(d.id);
    if (!['still-present', 'resolved', 'superseded', 'declined', 'unverified'].includes(d.status)) throw new Error('Invalid prior finding state');
    if (d.status !== 'unverified' && !d.evidence.length) throw new Error('Re-review needs current evidence');
    if (d.status === 'still-present' && !current.some(f => f.id === d.currentFindingId || f.title === d.currentFindingId)) throw new Error('Still-present item must link a current finding');
    return { ...d, head, originalHead: original.originalHead, originalEvidence: original.evidence };
  });
  for (const old of prior.findings) if (!seen.has(old.id)) rounds.push({ id: old.id, status: 'unverified', reason: 'No current assessment', head, originalHead: old.originalHead, originalEvidence: old.evidence, evidence: [] });
  // Preserve private history including resolved findings. Publication consumes only
  // current actionable findings and can consult round status to avoid repetition.
  return { schemaVersion: 1, repository, head, findings: [...prior.findings, ...current.filter(f => !prior.findings.some(p => p.id === f.id))], rounds: [...(prior.rounds ?? []), ...rounds] };
}
