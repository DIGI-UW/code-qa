import { validateDecisions } from './decisions.mjs';
import { validateHistory } from './history.mjs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { snapshot, sourcePath, SHA } from './snapshot.mjs';
import { LEVELS, PROFILES, PRESET_VERSION, resolveLevel } from './levels.mjs';
import { validateChecks } from './checks.mjs';
import { reviewerAdapter } from './reviewers/index.mjs';

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer in ${min}..${max}`);
}
export function validatePlan(plan) {
  if (plan.schemaVersion !== 4 || !/^[0-9a-f-]{36}$/.test(plan.id)) throw new Error('Unsupported plan version/id; create a new plan');
  if (!Object.hasOwn(LEVELS, plan.level) || plan.presetVersion !== PRESET_VERSION) throw new Error('Unknown level/preset');
  if (!Object.hasOwn(PROFILES, plan.profile)) throw new Error('Unknown execution profile');
  if (JSON.stringify(plan.requiredEvidence) !== JSON.stringify(LEVELS[plan.level].evidence)) throw new Error('Level evidence obligations changed; create a new plan');
  if (!['pr', 'targeted'].includes(plan.application) || (plan.application === 'targeted' && !plan.question?.trim())) throw new Error('Targeted review needs a question');
  if (!['mechanical', 'standard'].includes(plan.rigor)) throw new Error('Unknown rigor; use --level L1..L5');
  if (plan.rigor !== (plan.level === 'L1' ? 'mechanical' : 'standard')) throw new Error('Mechanical and AI level mismatch');
  if (!['none', 'openelis', 'container'].includes(plan.environment)) throw new Error('Unknown environment');
  if (plan.level === 'L1' ? plan.adapter !== 'none' : plan.adapter === 'none') throw new Error('L1 must use no AI; other levels require a reviewer');
  if (plan.adapter !== 'none') reviewerAdapter(plan.adapter).validate(plan);
  if (!['subscription', 'api', 'unknown'].includes(plan.billingMode)) throw new Error('Unknown billing mode');
  if (plan.level === 'L1' && plan.model) throw new Error('L1 cannot select a model');
  if (plan.maxUsd !== undefined || plan.maxTokens !== undefined || plan.maxSessions !== (plan.level === 'L1' ? 0 : 1)) throw new Error('Hard token/currency caps and extra reviewer sessions are unsupported');
  integer(plan.reviewSeconds, 'reviewSeconds', plan.level === 'L1' ? 0 : 1, 1800);
  integer(plan.startupSeconds, 'startupSeconds', 1, 7200);
  if ('maxContextBytes' in plan) throw new Error('Source-byte limits were removed; create a repository review plan');
  if (typeof plan.lens !== 'string' || plan.lens.length > 200) throw new Error('Invalid lens');
  for (const field of ['base', 'head', 'mergeBase']) if (!SHA.test(plan.snapshot?.[field])) throw new Error('Invalid snapshot revision');
  if (!Array.isArray(plan.paths) || !Array.isArray(plan.contextPaths)) throw new Error('Invalid scope');
  for (const path of [...plan.paths, ...plan.contextPaths]) sourcePath(path);
  if (typeof plan.snapshot.repo !== 'string' || !plan.snapshot.repo.startsWith('/')) throw new Error('Repository must be absolute');
  if (typeof plan.purpose !== 'string' || typeof plan.requirements !== 'string') throw new Error('Invalid purpose/requirements');
  validateDecisions(plan.decisions ?? []);
  validateHistory(plan.history ?? null);
  if (plan.environment === 'container' && (typeof plan.image !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/@:-]+$/.test(plan.image))) throw new Error('Choose a trusted container image');
  validateChecks(plan.checks);
  if (plan.checks.length && plan.environment === 'none') throw new Error('Executable checks require an isolated environment');
  if (plan.environment === 'openelis' && plan.pullRequest && plan.pullRequest.repository !== 'DIGI-UW/OpenELIS-Global-2') throw new Error('OpenELIS environment only supports DIGI-UW/OpenELIS-Global-2');
  return plan;
}
export async function createPlan(options) {
  if (options.maxContextBytes !== undefined) throw new Error('Source-byte limits were removed; reviewers inspect the repository as needed');
  const preset = resolveLevel(options), ai = preset.level !== 'L1';
  const profile = options.profile ?? 'development';
  if (!Object.hasOwn(PROFILES, profile)) throw new Error('Unknown execution profile');
  const defaults = PROFILES[profile];
  const plan = {
    schemaVersion: 4, profile, requiredEvidence: [...preset.evidence], presetVersion: PRESET_VERSION, id: randomUUID(), createdAt: new Date().toISOString(),
    snapshot: await snapshot(options.repo, options.base, options.head),
    level: preset.level, lens: options.lens ?? '', reasoningEffort: options.reasoningEffort ?? defaults.reasoningEffort,
    application: options.application ?? (options.question ? 'targeted' : 'pr'), question: options.question ?? '',
    purpose: options.purpose ?? 'Review the selected change for actionable defects and misplaced responsibilities.',
    requirements: options.requirements ?? '', paths: options.paths ?? [], contextPaths: options.contextPaths ?? [],
    rigor: ai ? 'standard' : 'mechanical', adapter: options.adapter ?? (ai ? 'codex' : 'none'), environment: options.environment ?? 'none',
    model: options.model ?? (ai ? defaults.model : ''), billingMode: options.billingMode ?? 'unknown', maxSessions: ai ? 1 : 0,
    reviewSeconds: options.reviewSeconds ?? (ai ? defaults.reviewSeconds : 0), startupSeconds: options.startupSeconds ?? 3600,
    checks: options.checks ?? [], image: options.image ?? 'node:22-bookworm',
    decisions: options.decisions ?? [], history: options.history ?? null,
    contextNotes: options.contextNotes ?? [], pullRequest: options.pullRequest ?? null,
    overrides: Object.fromEntries(['model','reviewSeconds','startupSeconds','reasoningEffort']
      .filter(key => options[key] !== undefined).map(key => [key, options[key]])),
    ...(options.maxUsd !== undefined ? { maxUsd: options.maxUsd } : {}),
    ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
  };
  validatePlan(plan);
  return plan;
}
export const runDirectory = (root, plan) => resolve(root, plan.id);
