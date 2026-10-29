import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { snapshot, sourcePath, SHA } from './snapshot.mjs';
import { LEVELS, MODELS, PRESET_VERSION, resolveLevel } from './levels.mjs';
import { validateChecks } from './checks.mjs';

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer in ${min}..${max}`);
}
export function validatePlan(plan) {
  if (plan.schemaVersion !== 2 || !/^[0-9a-f-]{36}$/.test(plan.id)) throw new Error('Unsupported plan version/id; create a new plan');
  if (!LEVELS[plan.level] || plan.presetVersion !== PRESET_VERSION) throw new Error('Unknown level/preset');
  if (!['pr', 'targeted'].includes(plan.application) || (plan.application === 'targeted' && !plan.question?.trim())) throw new Error('Targeted review needs a question');
  if (!['mechanical', 'standard'].includes(plan.rigor)) throw new Error('Unknown rigor; use --level L1..L5');
  if (plan.rigor !== (plan.level === 'L1' ? 'mechanical' : 'standard')) throw new Error('Mechanical and AI level mismatch');
  if (!['none', 'openelis'].includes(plan.environment)) throw new Error('Unknown environment');
  if (plan.adapter !== (plan.level === 'L1' ? 'none' : 'codex')) throw new Error('L1 must use no AI; other levels require Codex');
  if (plan.adapter === 'codex' && (!MODELS.includes(plan.model) || !['subscription', 'api', 'unknown'].includes(plan.billingMode))) throw new Error('Choose an allowed Sol/Luna model and billing mode');
  if (plan.level === 'L1' && plan.model) throw new Error('L1 cannot select a model');
  if (plan.maxUsd !== undefined || plan.maxTokens !== undefined || plan.maxSessions !== (plan.level === 'L1' ? 0 : 1)) throw new Error('Hard token/currency caps and extra reviewer sessions are unsupported');
  integer(plan.reviewSeconds, 'reviewSeconds', plan.level === 'L1' ? 0 : 1, 1800);
  integer(plan.startupSeconds, 'startupSeconds', 1, 7200);
  integer(plan.maxContextBytes, 'maxContextBytes', 100, 1_000_000);
  if (!['low', 'medium', 'high'].includes(plan.reasoningEffort)) throw new Error('Unsupported reasoning effort');
  if (typeof plan.lens !== 'string' || plan.lens.length > 200) throw new Error('Invalid lens');
  for (const field of ['base', 'head', 'mergeBase']) if (!SHA.test(plan.snapshot?.[field])) throw new Error('Invalid snapshot revision');
  if (!Array.isArray(plan.paths) || !Array.isArray(plan.contextPaths)) throw new Error('Invalid scope');
  for (const path of [...plan.paths, ...plan.contextPaths]) sourcePath(path);
  if (typeof plan.snapshot.repo !== 'string' || !plan.snapshot.repo.startsWith('/')) throw new Error('Repository must be absolute');
  if (typeof plan.purpose !== 'string' || typeof plan.requirements !== 'string') throw new Error('Invalid purpose/requirements');
  validateChecks(plan.checks);
  if (plan.checks.length && plan.environment !== 'openelis') throw new Error('Executable checks require the isolated OpenELIS environment');
  if (['L4','L5'].includes(plan.level) && !plan.checks.length) throw new Error('L4/L5 require explicit verification checks with JUnit reports');
  if (plan.level === 'L5' && !plan.checks.some(c => c.kind === 'scenario')) throw new Error('L5 requires a scenario check');
  if (plan.environment === 'openelis' && plan.pullRequest && plan.pullRequest.repository !== 'DIGI-UW/OpenELIS-Global-2') throw new Error('OpenELIS environment only supports DIGI-UW/OpenELIS-Global-2');
  return plan;
}
export async function createPlan(options) {
  const preset = resolveLevel(options), ai = preset.level !== 'L1';
  const plan = {
    schemaVersion: 2, presetVersion: PRESET_VERSION, id: randomUUID(), createdAt: new Date().toISOString(),
    snapshot: await snapshot(options.repo, options.base, options.head),
    level: preset.level, lens: options.lens ?? '', reasoningEffort: options.reasoningEffort ?? preset.reasoningEffort,
    application: options.application ?? (options.question ? 'targeted' : 'pr'), question: options.question ?? '',
    purpose: options.purpose ?? 'Review the selected change for actionable defects and misplaced responsibilities.',
    requirements: options.requirements ?? '', paths: options.paths ?? [], contextPaths: options.contextPaths ?? [],
    rigor: ai ? 'standard' : 'mechanical', adapter: options.adapter ?? (ai ? 'codex' : 'none'), environment: options.environment ?? 'none',
    model: options.model ?? (ai ? 'gpt-6.1-sol' : ''), billingMode: options.billingMode ?? 'unknown', maxSessions: ai ? 1 : 0,
    reviewSeconds: options.reviewSeconds ?? preset.reviewSeconds, startupSeconds: options.startupSeconds ?? 3600,
    maxContextBytes: options.maxContextBytes ?? preset.maxContextBytes, checks: options.checks ?? [],
    contextNotes: options.contextNotes ?? [], pullRequest: options.pullRequest ?? null,
    overrides: Object.fromEntries(['model','reviewSeconds','startupSeconds','maxContextBytes','reasoningEffort']
      .filter(key => options[key] !== undefined).map(key => [key, options[key]])),
    ...(options.maxUsd !== undefined ? { maxUsd: options.maxUsd } : {}),
    ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
  };
  validatePlan(plan);
  return plan;
}
export const runDirectory = (root, plan) => resolve(root, plan.id);
