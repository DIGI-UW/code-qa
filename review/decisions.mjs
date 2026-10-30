import { SHA } from './snapshot.mjs';

// Only operator inputs can designate accepted intent. Contributor prose is context,
// even when GitHub labels its author OWNER/MEMBER; association is not approval.
export function validateDecisions(decisions) {
  if (!Array.isArray(decisions)) throw new Error('decisions must be an array');
  const ids = new Set();
  for (const d of decisions) {
    if (!d.id || ids.has(d.id)) throw new Error('Decision IDs must be unique');
    ids.add(d.id);
    for (const key of ['source', 'author', 'authority', 'retrievedAt', 'statement', 'previousExpectation', 'replacementExpectation'])
      if (typeof d[key] !== 'string') throw new Error('Missing decision provenance: ' + key);
    if (!d.source.trim() || !d.author.trim() || !d.statement.trim() || !SHA.test(d.revision) || !Number.isFinite(Date.parse(d.retrievedAt))) throw new Error('Invalid decision provenance');
    if (!['accepted', 'proposed', 'conflicting', 'unavailable'].includes(d.status)) throw new Error('Invalid decision status');
    if (d.status === 'accepted' && !d.authority.trim()) throw new Error('Accepted decision needs explicit authority');
  }
  return decisions;
}
export const decisionGaps = decisions => decisions.filter(d => ['conflicting', 'unavailable'].includes(d.status))
  .map(d => 'Decision ' + d.id + ' is ' + d.status + ': ' + d.statement);
