#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createPlan, validatePlan } from './plan.mjs';
import { runReview, exitCode } from './run.mjs';
import { OpenELISEnvironment } from './environments/openelis.mjs';
import { collectPR } from './github.mjs';
import { snapshot, packetFor } from './snapshot.mjs';
import { prepareContext, trustedConfig, configurationRequirements } from './context.mjs';
import { LEVELS, resolveLevel } from './levels.mjs';

const help = `code-qa v0.3
  levels
  plan   --pr https://github.com/OWNER/REPO/pull/NUMBER --level L1..L5 [options] --out plan.json
  review --pr URL --level L1..L5 [options] [--out /durable/runs]
  plan/review --repo PATH --base REF --head REF [options]
  run --plan plan.json --out /durable/runs
  cleanup --run /durable/runs/RUN_ID

Options:
  --application pr|targeted --question TEXT --lens TEXT
  --path PATH (repeatable) --context FILE (repeatable)
  --requirements FILE --config FILE --environment none|openelis
  --model gpt-6.1-sol --billing-mode subscription|api|unknown
  --review-seconds N --reasoning-effort low|medium|high
  --startup-seconds N --checks FILE
Config/check files are explicit trusted operator inputs, not PR instructions.
L1: no AI. L2: small focused review. L3: broader source review.
L4: declared tests. L5: declared scenarios. L4/L5 need --environment openelis
and a checks JSON array (id, kind: test|scenario, argv, reports, timeoutSeconds).
All AI levels use at most one Sol/Luna session. No automatic retry or model upgrade.
--config overrides the repository's .code-qa.json read from the base revision.
Legacy --rigor mechanical|standard aliases map to L1/L3.
Reports are local; nothing is repaired, posted, pushed or merged.
Exit 0: execution complete (may include findings); 2: partial/error; 3: stale/cancelled.
`;
try {
  const { values: v, positionals } = parseArgs({ allowPositionals: true, strict: true, options: {
    help: { type:'boolean' }, pr:{type:'string'}, repo:{type:'string'}, base:{type:'string'}, head:{type:'string'},
    out:{type:'string'}, plan:{type:'string'}, run:{type:'string'}, level:{type:'string'}, lens:{type:'string'},
    application:{type:'string'}, question:{type:'string'}, purpose:{type:'string'}, requirements:{type:'string'},
    path:{type:'string',multiple:true}, context:{type:'string',multiple:true},
    config:{type:'string'}, checks:{type:'string'}, environment:{type:'string'}, rigor:{type:'string'},
    adapter:{type:'string'}, model:{type:'string'}, 'billing-mode':{type:'string'}, 'reasoning-effort':{type:'string'},
    'review-seconds':{type:'string'},'startup-seconds':{type:'string'},
  }});
  const action = positionals[0];
  if (v.help || !action) { console.log(help); process.exit(0); }
  if (positionals.length !== 1) throw new Error('Expected one command');
  if (action === 'levels') { console.log(JSON.stringify(LEVELS,null,2)); process.exit(0); }
  let plan;
  if (['plan','review'].includes(action)) {
    resolveLevel(v); // Reject unknown levels before network or any model use.
    if (v.pr && (v.base || v.head)) throw new Error('--pr cannot be combined with --base/--head');
    const source = v.pr ? await collectPR(v.pr,v.repo) : {repo:v.repo,base:v.base,head:v.head};
    if (!source.repo || !source.base || !source.head) throw new Error('Provide --pr or --repo/--base/--head');
    const snap = await snapshot(source.repo,source.base,source.head);
    const config = await trustedConfig(snap,v.config ? JSON.parse(await readFile(v.config,'utf8')) : null);
    const checks = v.checks ? JSON.parse(await readFile(v.checks,'utf8')) : config.checks ?? [];
    const neighbors = await prepareContext(snap,v.path ?? [],v.context ?? [],config);
    const baseRequirements = await configurationRequirements(snap,config);
    const requirements = [baseRequirements, v.requirements ? await readFile(v.requirements,'utf8') : ''].filter(Boolean).join('\n\n');
    plan = await createPlan({...source,...neighbors,application:v.application,question:v.question,purpose:v.purpose,
      requirements,paths:v.path,environment:v.environment ?? config.environment,level:v.level,rigor:v.rigor,lens:v.lens,
      adapter:v.adapter,model:v.model,billingMode:v['billing-mode'],reasoningEffort:v['reasoning-effort'], checks,
      ...(v['review-seconds'] ? {reviewSeconds:Number(v['review-seconds'])}:{}),
      ...(v['startup-seconds'] ? {startupSeconds:Number(v['startup-seconds'])}:{}),
    });
    const packet = await packetFor(plan);
    const preview = {level:plan.level,model:plan.model,sessions:plan.maxSessions,reviewSeconds:plan.reviewSeconds,
      sourceAccess:packet.sourceAccess,changedFiles:packet.selectedPaths.length,
      contextFiles:plan.contextPaths.length,checks:plan.checks.map(c=>({id:c.id,kind:c.kind,timeoutSeconds:c.timeoutSeconds})),environment:plan.environment,startupSeconds:plan.startupSeconds,omissions:packet.omissions};
    if (action === 'plan') {
      if (!v.out) throw new Error('plan requires --out');
      const out=resolve(v.out);await mkdir(dirname(out),{recursive:true,mode:0o700});
      await writeFile(out,JSON.stringify(plan,null,2)+'\n',{flag:'wx',mode:0o600});
      console.log(JSON.stringify({plan:out,...preview},null,2));process.exit(0);
    }
    console.error(JSON.stringify(preview,null,2));
  } else if (action === 'run') {
    if (!v.plan) throw new Error('run requires --plan');
    plan=JSON.parse(await readFile(v.plan,'utf8'));
  } else if (action === 'cleanup') {
    if (!v.run) throw new Error('cleanup requires --run');
    const directory=resolve(v.run), saved=JSON.parse(await readFile(join(directory,'plan.json'),'utf8'));
    // Recovery also supports v0.1 plans: worker identity, not new review settings, determines ownership.
    if (!/^[0-9a-f-]{36}$/.test(saved.id) || directory.split('/').at(-1)!==saved.id || saved.environment!=='openelis') throw new Error('Run directory does not identify an OpenELIS worker');
    const environment=new OpenELISEnvironment(saved,directory);environment.owned=true;
    console.log(await environment.cleanup());process.exit(0);
  } else throw new Error('Unknown command: '+action);
  validatePlan(plan);
  const controller=new AbortController();
  for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>controller.abort());
  const result=await runReview(plan,resolve(v.out ?? join(homedir(),'code-qa-runs')),{
    signal:controller.signal,onProgress:phase=>console.error('[code-qa] '+phase),
  });
  console.log(JSON.stringify({directory:result.directory,status:result.run.status,assessment:result.run.assessment,reasons:result.run.reasons},null,2));
  process.exitCode=exitCode(result.run);
} catch(error) {console.error(error.message);process.exitCode=2;}
