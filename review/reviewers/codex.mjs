import {strictSchema,normalizeOptional} from './schema.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { command, requireSuccess } from '../process.mjs';
import { reviewerSchema } from '../report.mjs';
import {prepareReview,inspectionCount} from './prepare.mjs';

export function codexArgs(plan, workdir, schema, output, images=[],broker={}) {
  return ['codex', 'exec', '--ignore-user-config', '--ignore-rules', '--strict-config', '--ephemeral',
    '--skip-git-repo-check', '--sandbox', 'read-only', '--cd', workdir,
    ...images.flatMap(path=>['--image',path]),
    ...(broker.config ? ['-c','mcp_servers.codeqa.command='+JSON.stringify(process.execPath),'-c','mcp_servers.codeqa.args='+JSON.stringify([broker.script,broker.config]),'-c','mcp_servers.codeqa.required=true','-c','mcp_servers.codeqa.default_tools_approval_mode="writes"'] : []),
    '--model', plan.model, '--color', 'never', '--json', '--output-schema', schema, '--output-last-message', output,
    '-c', 'model_reasoning_effort=' + JSON.stringify(plan.reasoningEffort),
    '-c', 'approval_policy="never"', '-c', 'shell_environment_policy.inherit="none"',
    '-c', 'shell_environment_policy.set={ PATH = "/usr/bin:/bin:/usr/sbin:/sbin" }', '-c', 'project_doc_max_bytes=0', '-c', 'web_search="disabled"',
    ...['shell_snapshot', 'apps', 'plugins', 'hooks', 'memories', 'multi_agent', 'multi_agent_v2',
      'browser_use', 'browser_use_external', 'computer_use', 'in_app_browser', 'image_generation',
      'shell_tool', 'goals', 'skill_search', 'skill_mcp_dependency_install', 'view_image', 'sleep_tool']
      .flatMap(feature => ['--disable', feature]),
    '--enable', 'code_mode_host', '--enable', 'skip_host_skill_discovery', '-'];
}
export async function reviewWithCodex(plan, packet, checks, directory, signal, execute = command) {
  const {workdir,repository,schema,output,input,images,brokerConfig,brokerScript,audit}=await prepareReview(plan,packet,checks,directory,signal);
  const result = await execute(codexArgs(plan, workdir, schema, output, images,{config:brokerConfig,script:brokerScript}), {
    cwd: workdir, input, timeoutMs: plan.reviewSeconds * 1000, signal, log: join(directory, 'codex.jsonl'),
  });
  requireSuccess(result, 'Codex review');
  const events = result.stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
  if (events.some(event => event.type === 'turn.failed' || event.type === 'error')) throw new Error('Codex reported a failed turn');
  const completed = events.filter(event => event.type === 'turn.completed');
  if (completed.length !== 1) throw new Error('Expected exactly one completed reviewer turn');
  const allowedItems = new Set(['agent_message', 'reasoning', 'error', 'mcp_tool_call']);
  if (events.some(event => event.item?.type && !allowedItems.has(event.item.type))) throw new Error('Reviewer used an unauthorized tool; result rejected');
  const report = normalizeOptional(JSON.parse(await readFile(output, 'utf8')),reviewerSchema);
  if(events.some(e=>e.item?.type==='mcp_tool_call' && (e.item.server!=='codeqa' || !['inspect','evidence'].includes(e.item.tool))))throw new Error('Unauthorized MCP tool');
  const commands=await inspectionCount(audit);
  if (report.coverage === 'complete' && !commands) throw new Error('No repository inspection recorded for a completed source review');
  return { report, inspection: { repository, commands }, usage: completed[0].usage ?? null, diagnostics: events.filter(e => e.item?.type === 'error').map(e => e.item.message) };
}
