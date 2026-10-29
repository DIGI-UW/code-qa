export const PRESET_VERSION = 1;
export const MODELS = ['gpt-6.1-sol', 'gpt-6-sol', 'gpt-6-luna'];
export const LEVELS = {
  L1: { name: 'Mechanical', reviewSeconds: 0, maxContextBytes: 32000, reasoningEffort: 'low' },
  L2: { name: 'Lightweight', reviewSeconds: 120, maxContextBytes: 32000, reasoningEffort: 'low' },
  L3: { name: 'Standard', reviewSeconds: 300, maxContextBytes: 200000, reasoningEffort: 'medium' },
  L4: { name: 'Verified', reviewSeconds: 600, maxContextBytes: 300000, reasoningEffort: 'high' },
  L5: { name: 'Deep', reviewSeconds: 900, maxContextBytes: 500000, reasoningEffort: 'high' },
};
export function resolveLevel(options) {
  const alias = options.rigor === 'mechanical' ? 'L1' : options.rigor === 'standard' ? 'L3' : undefined;
  if (options.rigor && !alias) throw new Error('Unknown rigor; use --level L1..L5');
  const level = options.level ?? alias ?? 'L1';
  if (!LEVELS[level]) throw new Error('Unknown level; use L1..L5');
  if (options.level && alias && alias !== level) throw new Error('Conflicting level and legacy rigor');
  return { level, ...LEVELS[level] };
}
