#!/usr/bin/env node
import {collectStack, validateStack} from './stack.mjs';
import {discoverOpenELISDesigns} from './design-discovery.mjs';
import {importReport,publication} from './exchange.mjs';
import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createPlan, validatePlan } from './plan.mjs';
import { runReview, exitCode } from './run.mjs';
import { OpenELISEnvironment } from './environments/openelis.mjs';
import { collectPR } from './github.mjs';
import { snapshot, packetFor } from './snapshot.mjs';
import { prepareContext, trustedConfig, configurationRequirements, configurationSnapshot } from './context.mjs';
import { LEVELS, resolveLevel } from './levels.mjs';

import { capabilityGaps } from './reviewers/index.mjs';

const help = `code-qa v0.6
  levels
  designs --repo /path/to/openelis-work --question "workflow or Jira key" [--head REF] --out FILE
  import --plan FILE --external FILE --out FILE
  publish --result FILE --finding ID --verified ID [repeat IDs] [--authorize-publication]
  plan   --pr https://github.com/OWNER/REPO/pull/NUMBER --level L1..L5 [options] --out plan.json
  review --pr URL --level L1..L5 [options] [--out /durable/runs]
  plan/review --repo PATH --base REF --head REF [options]
  plan/review --stack --repo PATH --level L1..L5 [--stack-layer PR_NUMBER] [--previous-stack PLAN] [options]
  run --plan plan.json --out /durable/runs
  cleanup --run /durable/runs/RUN_ID

Options:
  --application pr|targeted|stack --question TEXT --lens TEXT
  --path PATH (repeatable) --context FILE (repeatable)
  --requirements FILE --config FILE --environment none|openelis|container --image IMAGE
  --decisions FILE --history FILE --scenarios FILE --workflows FILE --designs FILE --runtime-check ID --sources FILE --history-depth N --probes FILE --experiments FILE --max-rounds 0..2
  --profile development --adapter codex|claude --model MODEL_ID --billing-mode subscription|api|unknown
  --review-seconds N --reasoning-effort low|medium|high
  --startup-seconds N --checks FILE
Config/check files are explicit trusted operator inputs, not PR instructions.
L1: no AI. L2: semantic review with explicit coverage and questions.
L3: test-strength proof. L4: running integration. L5: product/design acceptance.
L3 needs declared isolated probes and a behavior-to-test map. L4 requires runtime identity and scenarios; L5 adds workflows and rendered design evidence.
L1/L2 can run declared checks in container/OpenELIS (kind: test|scenario|command, argv, reports,
timeoutSeconds); those checks do not imply completion of a higher level.
The development profile uses one inexpensive Sol session by default; --max-rounds explicitly reserves up to two reconsideration rounds within the same time allowance; --model overrides it.
No automatic retry or model upgrade. Provider-specific model availability still applies.
--config overrides the repository's .code-qa.json read from the base revision.
Legacy --rigor mechanical|standard aliases map to L1/L3.
Reviews stay local. Only explicit publish --authorize-publication posts selected, operator-verified findings; no repair, push or merge.
Exit 0: execution complete (may include findings); 2: partial/error; 3: stale/cancelled.
`;
try {
  const { values: v, positionals } = parseArgs({ allowPositionals: true, strict: true, options: {
    stack:{type:'boolean'},'stack-layer':{type:'string'},'previous-stack':{type:'string'},external:{type:'string'},result:{type:'string'},finding:{type:'string',multiple:true},verified:{type:'string',multiple:true},'authorize-publication':{type:'boolean'},help: { type:'boolean' }, pr:{type:'string'}, repo:{type:'string'}, base:{type:'string'}, head:{type:'string'},
    out:{type:'string'}, plan:{type:'string'}, run:{type:'string'}, level:{type:'string'}, lens:{type:'string'},
    application:{type:'string'}, question:{type:'string'}, purpose:{type:'string'}, requirements:{type:'string'},
    path:{type:'string',multiple:true}, context:{type:'string',multiple:true},
    scenarios:{type:'string'},workflows:{type:'string'},designs:{type:'string'},'runtime-check':{type:'string'},sources:{type:'string'},'history-depth':{type:'string'},probes:{type:'string'},experiments:{type:'string'},'max-rounds':{type:'string'},image:{type:'string'},decisions:{type:'string'},history:{type:'string'},config:{type:'string'}, checks:{type:'string'}, environment:{type:'string'}, rigor:{type:'string'},
    profile:{type:'string'}, adapter:{type:'string'}, model:{type:'string'}, 'billing-mode':{type:'string'}, 'reasoning-effort':{type:'string'},
    'review-seconds':{type:'string'},'startup-seconds':{type:'string'},
  }});
  const action = positionals[0];
  if (v.help || !action) { console.log(help); process.exit(0); }
  if (positionals.length !== 1) throw new Error('Expected one command');
  if (action === 'levels') { console.log(JSON.stringify(LEVELS,null,2)); process.exit(0); }
  if(action==='designs') {
    if(!v.repo||!v.question||!v.out)throw new Error('designs requires --repo, --question and --out');
    await writeFile(resolve(v.out),JSON.stringify(await discoverOpenELISDesigns(v.repo,v.question,v.head??'HEAD'),null,2)+'\n',{flag:'wx',mode:0o600});process.exit(0);
  }
  if(action==='import') {
    if(!v.plan||!v.external||!v.out)throw new Error('import requires --plan, --external and --out');
    const result=await importReport(JSON.parse(await readFile(v.external,'utf8')),JSON.parse(await readFile(v.plan,'utf8')));
    await writeFile(resolve(v.out),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});console.log('Imported with external origin; execution remains unverified');process.exit(0);
  }
  if(action==='publish') {
    if(!v.result)throw new Error('publish requires --result');
    console.log(JSON.stringify(await publication(JSON.parse(await readFile(v.result,'utf8')),{ids:v.finding,verifiedIds:v.verified,authorize:!!v['authorize-publication']}),null,2));process.exit(0);
  }
  let plan;
  if (['plan','review'].includes(action)) {
    resolveLevel(v); // Reject unknown levels before network or any model use.
    if (v.pr && (v.base || v.head)) throw new Error('--pr cannot be combined with --base/--head');
    if (v.stack && (v.pr || v.base || v.head || v.application && v.application !== 'stack')) throw new Error('--stack selects its own base/head and stack application');
    if (!v.stack && (v['stack-layer'] || v['previous-stack'])) throw new Error('Stack options require --stack');
    if (v['stack-layer'] && !/^[1-9][0-9]*$/.test(v['stack-layer'])) throw new Error('--stack-layer must be a PR number');
    const source = v.stack ? await collectStack(v.repo, {layerNumber: Number(v['stack-layer']) || undefined}) : v.pr ? await collectPR(v.pr,v.repo) : {repo:v.repo,base:v.base,head:v.head};
    if (v['previous-stack']) {
      const previous = validatePlan(JSON.parse(await readFile(v['previous-stack'],'utf8')));
      validateStack(previous.stack);
      if(previous.stack.repository !== source.stack.repository || previous.stack.trunk !== source.stack.trunk) throw new Error('Previous stack repository/trunk mismatch');
      source.stack.previous = {...previous.stack};
      delete source.stack.previous.previous;
    }
    if (!source.repo || !source.base || !source.head) throw new Error('Provide --pr or --repo/--base/--head');
    const snap = await snapshot(source.repo,source.base,source.head);
    const configSnapshot = configurationSnapshot(snap, source.stack);
    const config = await trustedConfig(configSnapshot,v.config ? JSON.parse(await readFile(v.config,'utf8')) : null);
    const checks = v.checks ? JSON.parse(await readFile(v.checks,'utf8')) : config.checks ?? [];
    const neighbors = await prepareContext(snap,v.path ?? [],v.context ?? [],config);
    const baseRequirements = await configurationRequirements(configSnapshot,config);
    const requirements = [baseRequirements, v.requirements ? await readFile(v.requirements,'utf8') : ''].filter(Boolean).join('\n\n');
    plan = await createPlan({...source,...neighbors,application:source.application ?? v.application,question:v.question,purpose:v.purpose,
      scenarios:v.scenarios ? JSON.parse(await readFile(v.scenarios,'utf8')) : config.scenarios ?? [],workflows:v.workflows ? JSON.parse(await readFile(v.workflows,'utf8')) : config.workflows ?? [],designs:v.designs ? JSON.parse(await readFile(v.designs,'utf8')) : config.designs ?? [],runtimeCheckId:v['runtime-check'] ?? config.runtimeCheckId,
      sources:v.sources ? JSON.parse(await readFile(v.sources,'utf8')) : config.sources ?? [],historyDepth:Number(v['history-depth'] ?? config.historyDepth ?? 1),
      probes:v.probes ? JSON.parse(await readFile(v.probes,'utf8')) : config.probes ?? [],experiments:v.experiments ? JSON.parse(await readFile(v.experiments,'utf8')) : config.experiments ?? [],maxRounds:Number(v['max-rounds'] ?? config.maxRounds ?? 0),
      decisions:v.decisions ? JSON.parse(await readFile(v.decisions,'utf8')) : config.decisions ?? [], history:v.history ? JSON.parse(await readFile(v.history,'utf8')) : null,image:v.image ?? config.image,
      requirements,paths:v.path,environment:v.environment ?? config.environment,level:v.level,rigor:v.rigor,lens:v.lens,
      profile:v.profile ?? config.profile,adapter:v.adapter ?? (resolveLevel(v).level === 'L1' ? undefined : config.adapter),model:v.model ?? (resolveLevel(v).level === 'L1' ? undefined : config.model),billingMode:v['billing-mode'],reasoningEffort:v['reasoning-effort'], checks,
      ...(v['review-seconds'] ? {reviewSeconds:Number(v['review-seconds'])}:{}),
      ...(v['startup-seconds'] ? {startupSeconds:Number(v['startup-seconds'])}:{}),
    });
    const packet = await packetFor(plan);
    const preview = {level:plan.level,requiredEvidence:plan.requiredEvidence,capabilityGaps:capabilityGaps(plan),profile:plan.profile,model:plan.model,sessions:plan.maxSessions,reviewSeconds:plan.reviewSeconds,
      stack:packet.stack,sourceAccess:packet.sourceAccess,changedFiles:packet.selectedPaths.length,
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
