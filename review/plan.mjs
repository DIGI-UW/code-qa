import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { snapshot, sourcePath, SHA } from './snapshot.mjs';

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer in ${min}..${max}`);
}
export function validatePlan(plan) {
  if (plan.schemaVersion !== 1 || !/^[0-9a-f-]{36}$/.test(plan.id)) throw new Error('Invalid plan version/id');
  if (!['pr', 'targeted'].includes(plan.application) || (plan.application === 'targeted' && !plan.question?.trim())) throw new Error('Targeted review needs a question');
  if (!['mechanical', 'standard'].includes(plan.rigor)) throw new Error('v0.1 supports mechanical and standard; Verified/Deep are not yet implemented');
  if (!['none', 'openelis'].includes(plan.environment)) throw new Error('Unknown environment');
  if (!['none', 'codex'].includes(plan.adapter) || (plan.rigor === 'mechanical') !== (plan.adapter === 'none')) throw new Error('Mechanical must use no AI; Standard requires Codex');
  if (plan.adapter === 'codex' && (!plan.model || !['subscription', 'api', 'unknown'].includes(plan.billingMode))) throw new Error('AI review requires an explicit model and billing mode');
  if (plan.maxUsd !== undefined || plan.maxTokens !== undefined || plan.maxSessions !== 1) throw new Error('This adapter enforces one session and a wall-clock limit; hard token/currency caps are unsupported');
  integer(plan.reviewSeconds, 'reviewSeconds', 1, 1800);
  integer(plan.startupSeconds, 'startupSeconds', 1, 7200);
  integer(plan.maxContextBytes, 'maxContextBytes', 100, 1_000_000);
  for (const field of ['base', 'head', 'mergeBase']) if (!SHA.test(plan.snapshot?.[field])) throw new Error('Invalid snapshot revision');
  if (!Array.isArray(plan.paths) || !Array.isArray(plan.contextPaths)) throw new Error('Invalid scope');
  for (const path of [...plan.paths, ...plan.contextPaths]) sourcePath(path);
  if (typeof plan.snapshot.repo !== 'string' || !plan.snapshot.repo.startsWith('/')) throw new Error('Repository must be absolute');
  if (typeof plan.purpose !== 'string' || typeof plan.requirements !== 'string') throw new Error('Invalid purpose/requirements');
  return plan;
}
export async function createPlan(options) {
  const plan = {
    schemaVersion: 1, id: randomUUID(), createdAt: new Date().toISOString(),
    snapshot: await snapshot(options.repo, options.base, options.head),
    application: options.application ?? 'pr', question: options.question ?? '',
    purpose: options.purpose ?? 'Review the selected change for actionable defects and misplaced responsibilities.',
    requirements: options.requirements ?? '', paths: options.paths ?? [], contextPaths: options.contextPaths ?? [],
    rigor: options.rigor ?? 'mechanical', adapter: options.adapter ?? 'none', environment: options.environment ?? 'none',
    model: options.model ?? '', billingMode: options.billingMode ?? 'unknown', maxSessions: 1,
    reviewSeconds: options.reviewSeconds ?? 300, startupSeconds: options.startupSeconds ?? 3600,
    maxContextBytes: options.maxContextBytes ?? 200_000,
    ...(options.maxUsd !== undefined ? { maxUsd: options.maxUsd } : {}),
    ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
  };
  validatePlan(plan);
  return plan;
}
export const runDirectory = (root, plan) => resolve(root, plan.id);
