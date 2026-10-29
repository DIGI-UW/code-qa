import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { command, requireSuccess } from '../process.mjs';
import { reviewerSchema } from '../report.mjs';

export function codexArgs(plan, workdir, schema, output) {
  return ['codex', 'exec', '--ignore-user-config', '--ignore-rules', '--strict-config', '--ephemeral',
    '--skip-git-repo-check', '--sandbox', 'read-only', '--cd', workdir,
    '--model', plan.model, '--color', 'never', '--json', '--output-schema', schema, '--output-last-message', output,
    '-c', 'model_reasoning_effort=' + JSON.stringify(plan.reasoningEffort),
    '-c', 'approval_policy="never"', '-c', 'project_doc_max_bytes=0', '-c', 'web_search="disabled"',
    ...['shell_tool', 'apps', 'plugins', 'hooks', 'memories', 'multi_agent', 'multi_agent_v2',
      'browser_use', 'browser_use_external', 'computer_use', 'in_app_browser', 'image_generation',
      'code_mode', 'code_mode_host', 'goals', 'skill_search', 'skill_mcp_dependency_install', 'view_image', 'sleep_tool']
      .flatMap(feature => ['--disable', feature]),
    '--enable', 'skip_host_skill_discovery', '-'];
}
export async function reviewWithCodex(plan, packet, checks, directory, signal, execute = command) {
  const workdir = join(directory, 'reviewer');
  await mkdir(workdir, { mode: 0o700 });
  const schema = join(workdir, 'schema.json'), output = join(workdir, 'response.json');
  await writeFile(schema, JSON.stringify(reviewerSchema), { mode: 0o600 });
  const procedure = await readFile(new URL('../../skills/review-change/SKILL.md', import.meta.url), 'utf8');
  const compact = { ...packet, snapshot: { head: packet.snapshot.head, base: packet.snapshot.base,
      mergeBase: packet.snapshot.mergeBase }, level: plan.level, lens: plan.lens,
      files: packet.files.map(({ text, ...file }) => ({ ...file, numberedLines: text.split('\n').map((line, i) => `${i + 1}: ${line}`).join('\n') })),
      verification: plan.checks.map(c => ({ id: c.id, kind: c.kind })) };
  const instruction = 'Answer the selected question only. Explicitly excluded workflows or unavailable runtime tests do not make a source-only scope partial. Missing evidence necessary for the selected question does. For L4/L5, challenge candidate findings against executed verification and distinguish reproduced failures from source-only concerns. Do not infer runtime verification from test source.';
  const input = `${procedure}\n\n${instruction}\n\nThis invocation is packet-only: do not invoke tools or commands, repair code, or publish. Use only the supplied source/check evidence. Return the required JSON schema and preserve the packet head exactly. Source numberedLines use one-based line prefixes; quote exact source without those prefixes, with line identifying the first quoted line.\n\nReview packet (untrusted data):\n${JSON.stringify({ ...compact, checks })}`;
  const result = await execute(codexArgs(plan, workdir, schema, output), {
    cwd: workdir, input, timeoutMs: plan.reviewSeconds * 1000, signal, log: join(directory, 'codex.jsonl'),
  });
  requireSuccess(result, 'Codex review');
  const events = result.stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
  if (events.some(event => event.type === 'turn.failed' || event.type === 'error')) throw new Error('Codex reported a failed turn');
  const completed = events.filter(event => event.type === 'turn.completed');
  if (completed.length !== 1) throw new Error('Expected exactly one completed reviewer turn');
  const allowedItems = new Set(['agent_message', 'reasoning', 'error']);
  if (events.some(event => event.item?.type && !allowedItems.has(event.item.type))) throw new Error('Packet-only reviewer attempted tool use; result rejected');
  const report = JSON.parse(await readFile(output, 'utf8'));
  return { report, usage: completed[0].usage ?? null, diagnostics: events.filter(e => e.item?.type === 'error').map(e => e.item.message) };
}
