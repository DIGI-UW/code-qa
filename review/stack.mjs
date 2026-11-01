import {command, requireSuccess} from './process.mjs';
import {collectPR, parsePR, readPR} from './github.mjs';
import {git, snapshot, SHA} from './snapshot.mjs';

// gh stack owns topology and branch operations. Collection never checks out,
// rebases, pushes or merges the repository being reviewed.
export async function readStack(repo, execute = command) {
  const result = requireSuccess(await execute(['gh', 'stack', 'view', '--json'], {cwd: repo}), 'Read gh stack');
  const data = JSON.parse(result.stdout);
  if (!data.trunk || !Array.isArray(data.branches) || !data.branches.length) throw new Error('No gh stack in this checkout');
  const active = data.branches.filter(b => !b.isMerged);
  if (!active.length) throw new Error('Stack has no active layers');
  if (data.branches.slice(data.branches.indexOf(active[0])).some(b => b.isMerged)) throw new Error('Merged layer inside active stack; sync gh stack first');
  const numbers = new Set(), names = new Set();
  for (const b of active) {
    if (!b.name || !SHA.test(b.head) || !SHA.test(b.base) || !b.pr?.url) throw new Error('Every active layer must be published; use gh stack submit first');
    const pr = parsePR(b.pr.url);
    if (pr.number !== b.pr.number || numbers.has(pr.number) || names.has(b.name)) throw new Error('Invalid or duplicate stack layer');
    numbers.add(pr.number); names.add(b.name);
  }
  return {trunk: data.trunk, branches: active};
}
const identity = graph => JSON.stringify({trunk: graph.trunk, branches: graph.branches.map(b => [b.name, b.head, b.base, b.pr.url])});

export function validateStack(stack) {
  if (!stack || stack.schemaVersion !== 1 || stack.provider !== 'gh-stack' || !stack.trunk || !stack.repository || !stack.layers?.length) throw new Error('Invalid native stack plan');
  const ids = new Set();
  for (const [index, layer] of stack.layers.entries()) {
    if (layer.id !== 'pr-' + layer.pullRequest?.number || ids.has(layer.id) || !layer.branch || layer.pullRequest.repository !== stack.repository) throw new Error('Invalid stack layer identity');
    ids.add(layer.id);
    for (const key of ['base', 'head', 'mergeBase']) if (!SHA.test(layer[key])) throw new Error('Invalid stack revision');
    if (layer.base !== layer.pullRequest.baseRefOid || layer.head !== layer.pullRequest.headRefOid) throw new Error('Stack PR revision mismatch');
    if (layer.pullRequest.baseRefName !== (index ? stack.layers[index - 1].branch : stack.trunk)) throw new Error('Stack dependency order mismatch');
    if (index && layer.base !== stack.layers[index - 1].head) throw new Error('Stack parent changed during collection');
  }
  if (!stack.graph || stack.graph.trunk !== stack.trunk || stack.graph.branches?.length !== stack.layers.length || stack.layers.some((l,i) => stack.graph.branches[i].head !== l.head || stack.graph.branches[i].name !== l.branch || stack.graph.branches[i].pr?.url !== l.pullRequest.url)) throw new Error('Stack topology does not match pinned layers');
  if (stack.selection !== 'combined' && !ids.has(stack.selection)) throw new Error('Unknown selected stack layer');
  if (stack.previous) validateStack(stack.previous);
  return stack;
}

export async function collectStack(repo, {execute = command, collect = collectPR, read = readPR, layerNumber} = {}) {
  if (!repo) throw new Error('--stack requires --repo pointing to a gh stack checkout');
  const graph = await readStack(repo, execute), layers = [];
  let repository;
  for (const branch of graph.branches) {
    const id = parsePR(branch.pr.url);
    if (repository && repository !== id.repository) throw new Error('A gh stack must belong to one repository; attach cross-repository dependencies separately');
    repository = id.repository;
    const result = await collect(branch.pr.url, repo, execute), pr = result.pullRequest;
    if (pr.headRefName !== branch.name || pr.headRefOid !== branch.head) throw new Error('Local and published stack differ at ' + branch.name + '; sync or submit explicitly before reviewing');
    const snap = await snapshot(result.repo, result.base, result.head);
    layers.push({id: 'pr-' + pr.number, branch: branch.name, base: snap.base, head: snap.head, mergeBase: snap.mergeBase, paths: snap.paths, pullRequest: pr});
  }
  if (identity(graph) !== identity(await readStack(repo, execute))) throw new Error('Stack changed during collection');
  for (const layer of layers) {
    const current = await read(layer.pullRequest, execute);
    if (current.state !== 'OPEN' || current.headRefOid !== layer.head || current.baseRefOid !== layer.base || current.baseRefName !== layer.pullRequest.baseRefName) throw new Error('Stack PR moved during collection');
  }
  const stack = validateStack({schemaVersion: 1, provider: 'gh-stack', repository, trunk: graph.trunk,
    selection: layerNumber ? 'pr-' + layerNumber : 'combined', observedAt: new Date().toISOString(), layers, graph});
  const selected = stack.selection === 'combined' ? null : layers.find(l => l.id === stack.selection);
  return {repo, base: selected?.base ?? layers[0].base, head: selected?.head ?? layers.at(-1).head,
    pullRequest: selected?.pullRequest ?? null, application: 'stack', stack};
}

export function stackSources(stack, repo) {
  if (!stack) return [];
  const sources = (state, prefix) => state.layers.map(l => ({id: prefix + l.id, repository: state.repository, repo,
    revision: l.head, base: l.base, mergeBase: l.mergeBase, role: 'stack', required: true, pullRequest: l.pullRequest.url}));
  return [...sources(stack, ''), ...(stack.previous ? sources(stack.previous, 'previous-') : [])];
}

export async function inspectStack(stack, repo) {
  if (!stack) return null;
  const gaps = [], layers = [];
  for (const layer of stack.layers) {
    const snap = await snapshot(repo, layer.base, layer.head);
    if (snap.mergeBase !== layer.mergeBase) throw new Error('Stack merge base changed');
    const includesCurrentParent = snap.mergeBase === layer.base;
    if (!includesCurrentParent) gaps.push(layer.id + ': needs restacking; current parent is not included in this layer');
    layers.push({...layer, includesCurrentParent});
  }
  const comparisons = [];
  if (stack.previous) {
    for (const layer of layers) {
      const old = stack.previous.layers.find(l => l.id === layer.id);
      const unchanged = old?.base === layer.base && old?.head === layer.head;
      comparisons.push({id: layer.id, status: !old ? 'added' : unchanged ? 'unchanged-revisions' : 'changed-revisions',
        parentChanged: Boolean(old && old.base !== layer.base), previousSource: old ? 'previous-' + layer.id : null,
        // Human-readable evidence only; never parsed as a correctness or cache gate.
        rangeDiff: old && !unchanged ? await git(repo, ['range-diff', '--no-color', '--no-ext-diff', '--no-textconv', old.mergeBase + '..' + old.head, layer.mergeBase + '..' + layer.head]) : ''});
    }
    for (const old of stack.previous.layers) if (!layers.some(l => l.id === old.id)) comparisons.push({id: old.id, status: 'removed', previousSource: 'previous-' + old.id});
  }
  return {repository: stack.repository, trunk: stack.trunk, selection: stack.selection, layers, gaps, comparisons,
    evidencePolicy: 'No automatic reuse of prior test/runtime evidence. An unchanged patch on a changed parent is not proof of unchanged behavior.'};
}

export async function isStackFresh(plan, execute = command) {
  if (!plan.stack) return true;
  if (identity(await readStack(plan.snapshot.repo, execute)) !== identity(plan.stack.graph)) return false;
  for (const layer of plan.stack.layers) {
    const current = await readPR(layer.pullRequest, execute);
    if (current.state !== 'OPEN' || current.baseRefOid !== layer.base || current.headRefOid !== layer.head || current.baseRefName !== layer.pullRequest.baseRefName || current.headRefName !== layer.branch) return false;
  }
  return true;
}

export function stackCoverageIds(stack) {
  if (!stack) return [];
  return stack.selection === 'combined' ? ['design', ...stack.layers.map(l => l.id), 'combined'] : ['design', stack.selection];
}
export function stackCoverageGaps(report, stack) {
  if (!stack) return [];
  const expected = stackCoverageIds(stack);
  const entries = report.stackCoverage ?? [], gaps = [];
  for (const id of expected) {
    const rows = entries.filter(e => e.id === id);
    if (rows.length !== 1 || rows[0].status !== 'assessed' || !rows[0].reason.trim()) gaps.push('Stack review missing or incomplete: ' + id);
  }
  for (const row of entries) if (!expected.includes(row.id)) gaps.push('Unexpected stack coverage: ' + row.id);
  return gaps;
}
