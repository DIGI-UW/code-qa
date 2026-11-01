import {reviewWithClaude} from './claude.mjs';
import { reviewWithCodex } from './codex.mjs';

// Trusted adapters declare capabilities, not model tiers. Plans cannot register
// executable adapters or grant themselves evidence capabilities.
const adapters = {
  codex: {
    evidence: ['source-review', 'behavior-assessment'],
    capabilities: { source:true, images:true, checkRequests:true, structuredOutput:true, cancellation:true, usage:true, hardCurrencyLimit:false },
    review: reviewWithCodex,
    validate(plan) {
      if (typeof plan.model !== 'string' || !plan.model.trim() || /[\x00-\x1f]/.test(plan.model)) throw new Error('Choose a nonempty model ID');
      if (!['low', 'medium', 'high'].includes(plan.reasoningEffort)) throw new Error('Unsupported Codex reasoning effort');
    },
  },
  claude: {
    evidence:['source-review','behavior-assessment'],
    capabilities:{source:true,images:false,checkRequests:true,structuredOutput:true,cancellation:true,usage:true,hardCurrencyLimit:false},
    review:reviewWithClaude,
    validate(plan) {
      if(typeof plan.model!=='string'||!plan.model.trim()||/[\x00-\x1f]/.test(plan.model))throw new Error('Choose a nonempty model ID');
      if(!['low','medium','high'].includes(plan.reasoningEffort))throw new Error('Unsupported Claude reasoning effort');
    },
  },
};
export function reviewerAdapter(name) {
  if (!Object.hasOwn(adapters, name)) throw new Error('Unknown reviewer adapter: ' + name);
  return adapters[name];
}
export function capabilityGaps(plan) {
  const available = new Set(['mechanical', ...(plan.adapter === 'none' ? [] : reviewerAdapter(plan.adapter).evidence)]);
  if (['container','openelis'].includes(plan.environment) && plan.probes?.length) available.add('test-strength');
  if(plan.environment==='openelis' || (plan.environment==='container' && plan.runtimeCheckId)) {
    available.add('runtime-identity');if(plan.scenarios?.length)available.add('integration-scenarios');
    if(plan.adapter!=='none' && plan.workflows?.length && reviewerAdapter(plan.adapter).capabilities.images)available.add('product-acceptance');
  }
  // JUnit labels alone do not prove test strength, runtime or product acceptance.
  return plan.requiredEvidence.filter(item => !available.has(item));
}
