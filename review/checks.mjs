import { sourcePath } from './snapshot.mjs';
export function validateChecks(checks) {
  if (!Array.isArray(checks) || checks.length > 20) throw new Error('checks must be an array of at most 20 checks');
  const ids = new Set();
  for (const check of checks) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(check.id) || ids.has(check.id)) throw new Error('Check IDs must be unique safe names');
    ids.add(check.id);
    if (!['test', 'scenario', 'command'].includes(check.kind)) throw new Error('Check kind must be test, scenario or command');
    if (!Array.isArray(check.argv) || !check.argv.length || check.argv.some(x => typeof x !== 'string' || !x || x.includes('\0'))) throw new Error('Check argv must contain nonempty strings');
    if (!Number.isInteger(check.timeoutSeconds) || check.timeoutSeconds < 1 || check.timeoutSeconds > 3600) throw new Error('Check timeout must be 1..3600 seconds');
    if (!Array.isArray(check.reports) || (check.kind !== 'command' && !check.reports.length)) throw new Error('Check needs JUnit XML report patterns');
    for (const path of check.reports) sourcePath(path);
    if (check.cwd) sourcePath(check.cwd);
  }
  return checks;
}
export function validateCheckResult(result, spec, head) {
  if (result.id !== spec.id || result.head !== head || result.kind !== spec.kind) throw new Error('Check evidence identity mismatch');
  if (result.status === 'error' && ['infrastructure-error','timeout','uncovered'].includes(result.outcome) && Number.isInteger(result.executed) && result.executed >= 0 && Array.isArray(result.assertions)) return result;
  if (!['pass', 'fail'].includes(result.status) || !Number.isInteger(result.executed) || result.executed < 1 ||
      !Array.isArray(result.assertions) || result.assertions.length !== result.executed ||
      result.assertions.some(a => typeof a.name !== 'string' || !a.name || typeof a.passed !== 'boolean')) throw new Error('No valid executed check assertions');
  if ((result.status === 'pass') !== (result.exitCode === 0 && result.assertions.every(a => a.passed))) throw new Error('Check outcome contradicts evidence');
  return result;
}
