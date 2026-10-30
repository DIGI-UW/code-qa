import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPlan, validatePlan } from '../../review/plan.mjs';
import { git, packetFor } from '../../review/snapshot.mjs';
import { prepareContext, trustedConfig } from '../../review/context.mjs';
import { parsePR, isPRFresh } from '../../review/github.mjs';
import { runReview } from '../../review/run.mjs';
import { command } from '../../review/process.mjs';
import { codexArgs } from '../../review/reviewers/codex.mjs';

async function fixture(t) {
  const dir=await mkdtemp(join(tmpdir(),'qa-levels-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await git(dir,['init','-b','main']);await git(dir,['config','user.name','Fixture']);await git(dir,['config','user.email','fixture@example.invalid']);
  await writeFile(join(dir,'producer.js'),'export const answer = 1;\n');
  await writeFile(join(dir,'consumer.js'),"import { answer } from './producer.js';\nexport const consumer = () => answer;\n");
  await writeFile(join(dir,'consumer.test.js'),"import { consumer } from './consumer.js';\n");
  await writeFile(join(dir,'.code-qa.json'),JSON.stringify({contextRules:[{paths:['consumer.js'],context:['producer.js']}]}));
  await git(dir,['add','.']);await git(dir,['commit','-m','base']);
  const base=(await git(dir,['rev-parse','HEAD'])).trim();
  await writeFile(join(dir,'consumer.js'),"import { answer } from './producer.js';\nexport const consumer = () => answer * 2;\n");
  await writeFile(join(dir,'.code-qa.json'),'{"checks":[{"argv":["malicious"]}]}');
  await git(dir,['add','.']);await git(dir,['commit','-m','change']);
  return {repo:dir,base,head:'HEAD'};
}
const check={id:'contract',kind:'test',argv:['mvn','test'],reports:['target/surefire-reports/*.xml'],timeoutSeconds:30};
const clean=async p=>({report:{schemaVersion:1,head:p.snapshot.head,summary:'Selected review complete.',coverage:'complete',omissions:[],findings:[]},usage:{input_tokens:1}});
test('all levels resolve to distinct work and explicit overrides; Sol ceiling holds',async t=>{
  const f=await fixture(t);
  for(const level of ['L1','L2','L3','L4','L5']){
    const p=await createPlan({...f,level,...(['L4','L5'].includes(level)?{environment:'openelis',checks:[{...check,kind:level==='L5'?'scenario':'test'}]}:{})});
    assert.equal(p.level,level);assert.equal(p.maxSessions,level==='L1'?0:1);
    if(level!=='L1')assert.equal(p.model,'gpt-6.1-sol');
  }
  const p=await createPlan({...f,level:'L2',reviewSeconds:40});
  assert.equal(p.reviewSeconds,40);assert.equal(p.maxContextBytes,undefined);
  assert.deepEqual(p.overrides,{reviewSeconds:40});
  assert.ok(codexArgs(p,'/work','/schema','/result').includes('model_reasoning_effort="low"'));
  for(const model of ['gpt-6-astra','made-up-model'])await assert.rejects(createPlan({...f,level:'L2',model}),/Sol\/Luna/);
  await assert.rejects(createPlan({...f,level:'L1',model:'gpt-6.1-sol'}),/cannot select/);
  await assert.rejects(createPlan({...f,level:'L7'}),/Unknown level/);
  await assert.rejects(createPlan({...f,level:'L2',rigor:'mechanical'}),/Conflicting/);
  await assert.rejects(createPlan({...f,level:'L4'}),/verification checks/);
  await assert.rejects(createPlan({...f,level:'L5',environment:'openelis',checks:[check]}),/scenario/);
  assert.throws(()=>validatePlan({...p,maxSessions:2}),/unsupported/);
});
test('base configuration supplies trusted context hints without copying dependencies',async t=>{
  const f=await fixture(t),p=await createPlan({...f,paths:['consumer.js']});
  const config=await trustedConfig(p.snapshot);
  assert.equal(config.checks,undefined);
  const context=await prepareContext(p.snapshot,p.paths,[],config);
  assert.ok(context.contextPaths.includes('producer.js'));
  assert.deepEqual(context.contextPaths, ['producer.js']);
  await assert.rejects(prepareContext(p.snapshot,p.paths,['missing.js']),/do not exist/);
  const packet=await packetFor({...p,...context});assert.equal(packet.omissions.length,0);
});
test('PR URL parsing and freshness use actual base/head, including a rebase',async()=>{
  const identity=parsePR('https://github.com/DIGI-UW/code-qa/pull/2');
  assert.equal(identity.repository,'DIGI-UW/code-qa');
  for(const url of ['https://evil.invalid/a/b/pull/2','https://github.com/../b/pull/2','https://github.com/a/b/pull/2;touch-x'])assert.throws(()=>parsePR(url));
  const plan={pullRequest:identity,snapshot:{head:'a',base:'b'}};
  const response=info=>async()=>({code:0,stdout:JSON.stringify(info)});
  assert.equal(await isPRFresh(plan,response({state:'OPEN',headRefOid:'a',baseRefOid:'b'})),true);
  assert.equal(await isPRFresh(plan,response({state:'OPEN',headRefOid:'a',baseRefOid:'c'})),false);
});
test('L4 and L5 execute selected checks before one reviewer and always clean up',async t=>{
  const f=await fixture(t);
  for(const level of ['L4','L5']){
    const spec={...check,kind:level==='L5'?'scenario':'test'}, p=await createPlan({...f,level,environment:'openelis',checks:[spec]});
    const events=[];
    const environmentFactory=()=>({
      async start(){events.push('start');},async verify(){return {id:'login',status:'pass',executed:3};},
      async runCheck(c){events.push(c.kind);return {id:c.id,kind:c.kind,head:p.snapshot.head,status:'fail',exitCode:1,executed:1,assertions:[{name:'contract assertion',passed:false}]};},
      async collect(){events.push('collect');},async cleanup(){events.push('cleanup');return 'removed';}
    });
    const r=await runReview(p,join(f.repo,'runs'),{environmentFactory,reviewer:async(p,packet,checks)=>{events.push('review');assert.equal(checks.at(-1).status,'fail');return clean(p);}});
    assert.deepEqual(events,['start',spec.kind,'collect','cleanup','review']);
    assert.equal(r.run.status,'complete');assert.equal(r.run.assessment,'findings');assert.equal(r.run.usage.sessions,1);
  }
});
test('obsolete source-byte limits and old plans cannot silently change review semantics',async t=>{
  const f=await fixture(t),p=await createPlan({...f,level:'L2'});
  await assert.rejects(createPlan({...f,level:'L2',maxContextBytes:100}),/Source-byte limits were removed/);
  assert.throws(()=>validatePlan({...p,schemaVersion:2}),/Unsupported plan version/);
  assert.throws(()=>validatePlan({...p,maxContextBytes:100}),/Source-byte limits were removed/);
});
test('remote movement during execution retains superseded evidence',async t=>{
  const f=await fixture(t),p=await createPlan({...f,level:'L2'});let n=0;
  const r=await runReview(p,join(f.repo,'runs'),{freshness:async()=>++n===1,reviewer:clean});
  assert.equal(r.run.status,'superseded');
});
test('one-command local review runs L1 without model access',async t=>{
  const f=await fixture(t);
  const cli=new URL('../../review/cli.mjs',import.meta.url).pathname;
  const r=await command([process.execPath,cli,'review','--repo',f.repo,'--base',f.base,'--head',f.head,'--level','L1','--out',join(f.repo,'runs')]);
  assert.equal(r.code,0,r.stderr);
  const result=JSON.parse(r.stdout),saved=JSON.parse(await readFile(join(result.directory,'result.json'),'utf8'));
  assert.equal(saved.plan.level,'L1');assert.equal(saved.usage.sessions,0);
});

test('L4 executor errors preserve cleanup and prevent model spend or clean clearance', async t => {
  const f = await fixture(t), p = await createPlan({...f,level:'L4',environment:'openelis',checks:[check]});
  const events = [];
  const r = await runReview(p,join(f.repo,'runs'),{environmentFactory:()=>({
    async start(){},async verify(){return {id:'login',status:'pass',executed:3};},
    async runCheck(){throw Error('No executed tests in fresh JUnit reports');},
    async collect(){events.push('collect');},async cleanup(){events.push('cleanup');return 'removed';}
  }),reviewer:async()=>{throw Error('must not call');}});
  assert.deepEqual(events,['collect','cleanup']);assert.equal(r.run.cleanup,'removed');
  assert.equal(r.run.status,'error');assert.equal(r.run.assessment,'undetermined');assert.equal(r.run.usage.sessions,0);
});
