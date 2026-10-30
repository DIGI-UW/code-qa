import { reviewWithCodex } from './codex.mjs';

// Trusted adapters declare capabilities, not model tiers. Plans cannot register
// executable adapters or grant themselves evidence capabilities.
const adapters = {
  codex: {
    evidence: ['source-review', 'behavior-assessment'],
    review: reviewWithCodex,
    validate(plan) {
      if (typeof plan.model !== 'string' || !plan.model.trim() || /[\x00-\x1f]/.test(plan.model)) throw new Error('Choose a nonempty model ID');
      if (!['low', 'medium', 'high'].includes(plan.reasoningEffort)) throw new Error('Unsupported Codex reasoning effort');
    },
  },
};
export function reviewerAdapter(name) {
  if (!Object.hasOwn(adapters, name)) throw new Error('Unknown reviewer adapter: ' + name);
  return adapters[name];
}
export function capabilityGaps(plan) {
  const available = new Set(['mechanical', ...(plan.adapter === 'none' ? [] : reviewerAdapter(plan.adapter).evidence)]);
  // JUnit labels alone do not prove test strength, runtime or product acceptance.
  return plan.requiredEvidence.filter(item => !available.has(item));
}
