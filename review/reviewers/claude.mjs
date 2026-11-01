import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {prepareReview,inspectionCount} from './prepare.mjs';
import {command,requireSuccess} from '../process.mjs';
import {normalizeOptional} from './schema.mjs';
import {reviewerSchema} from '../report.mjs';
export function claudeArgs(plan,config,schema) {
 return ['claude','--print','--restricted','--setting-sources','','--settings','{"disableAllHooks":true}',
  '--disable-slash-commands','--strict-mcp-config','--mcp-config',config,
  '--tools','','--allowedTools','mcp__codeqa__inspect,mcp__codeqa__evidence',
  '--permission-mode','dontAsk','--permission-prompts','none','--no-session-persistence',
  '--model',plan.model,'--effort',plan.reasoningEffort,'--output-format','stream-json','--verbose',
  '--json-schema',schema];
}
export async function reviewWithClaude(plan,packet,checks,directory,signal,execute=command) {
 const prepared=await prepareReview(plan,packet,checks,directory,signal);
 const {workdir,schema,input,brokerConfig,brokerScript,audit}=prepared;
 const config=join(workdir,'mcp.json');
 await writeFile(config,JSON.stringify({mcpServers:{codeqa:{command:process.execPath,args:[brokerScript,brokerConfig]}}}),{mode:0o600});
 const result=await execute(claudeArgs(plan,config,await readFile(schema,'utf8')),{cwd:workdir,input,signal,timeoutMs:plan.reviewSeconds*1000,log:join(directory,'claude.jsonl')});
 requireSuccess(result,'Claude review');
 const events=result.stdout.split('\n').filter(Boolean).map(JSON.parse);
 const final=events.filter(e=>e.type==='result');
 if(final.length!==1||final[0].is_error||final[0].subtype!=='success')throw new Error('Claude did not return a successful structured result');
 for(const event of events)for(const item of event.message?.content??[])if(item.type==='tool_use'&&!['mcp__codeqa__inspect','mcp__codeqa__evidence','StructuredOutput'].includes(item.name))throw new Error('Claude used an unauthorized tool');
 const report=normalizeOptional(final[0].structured_output,reviewerSchema);
 const commands=await inspectionCount(audit);
 if(report?.coverage==='complete'&&!commands)throw new Error('No repository inspection recorded for a completed source review');
 return {report,inspection:{repository:prepared.repository,commands},usage:{...final[0].usage,total_cost_usd:final[0].total_cost_usd},diagnostics:[]};
}
