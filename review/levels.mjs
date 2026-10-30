export const PRESET_VERSION = 3;
export const REVIEW_AREAS = ['intent', 'ownership', 'consumers', 'tests'];
const source = ['mechanical', 'source-review', 'behavior-assessment'];
const strength = [...source, 'test-strength'];
const runtime = [...strength, 'runtime-identity', 'integration-scenarios'];
export const LEVELS = {
  L1: { name: 'Mechanical verification', evidence: ['mechanical'] },
  L2: { name: 'Semantic review', evidence: source },
  L3: { name: 'Verified behavior and test strength', evidence: strength },
  L4: { name: 'Running integration review', evidence: runtime },
  L5: { name: 'Full-stack product acceptance', evidence: [...runtime, 'product-acceptance'] },
};
// Development defaults keep testing inexpensive; they do not restrict models.
export const PROFILES = {
  development: { model: 'gpt-6.1-sol', reviewSeconds: 120, reasoningEffort: 'low' },
};
export function resolveLevel(options) {
  const alias = options.rigor === 'mechanical' ? 'L1' : options.rigor === 'standard' ? 'L3' : undefined;
  if (options.rigor && !alias) throw new Error('Unknown rigor; use --level L1..L5');
  const level = options.level ?? alias ?? 'L1';
  if (!Object.hasOwn(LEVELS, level)) throw new Error('Unknown level; use L1..L5');
  if (options.level && alias && alias !== level) throw new Error('Conflicting level and legacy rigor');
  return { level, ...LEVELS[level] };
}
