import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {git,packetFor,captureSourceEvidence} from '../../review/snapshot.mjs';
import {createPlan} from '../../review/plan.mjs';
import {runReview} from '../../review/run.mjs';
import {inspectSources} from '../../review/sources.mjs';
import {cleanReport} from './fixtures.mjs';
async function fixture(t){
 const repo=await mkdtemp(join(tmpdir(),'qa-experiment-'));t.after(()=>rm(repo,{recursive:true,force:true}));
 await git(repo,['init','-b','main']);await git(repo,['config','user.name','fixture']);await git(repo,['config','user.email','fixture@example.invalid']);
 await writeFile(join(repo,'value.js'),'export const value=1;\n');await git(repo,['add','.']);await git(repo,['commit','-m','base']);
 const base=(await git(repo,['rev-parse','HEAD'])).trim();
 await writeFile(join(repo,'value.js'),'export const value=2;\n');await git(repo,['add','.']);await git(repo,['commit','-m','head']);return {repo,base,head:'HEAD'};
}
test('bounded experiment refutes suspicion, cannot execute undeclared commands and cleans up after reconsideration',async t=>{
 const f=await fixture(t),events=[];
 const check={id:'precision',kind:'test',argv:['node','test.js'],reports:['result.xml'],timeoutSeconds:10};
 const plan=await createPlan({...f,level:'L2',environment:'container',experiments:[check],maxRounds:1});
 let rounds=0;
 const environmentFactory=()=>({async start(){},async verify(){return {id:'ready',executed:1,status:'pass'};},async runCheck(c){events.push(c.id);return {id:c.id,kind:c.kind,head:plan.snapshot.head,executed:1,status:'pass',exitCode:0,assertions:[{name:'precision preserved',passed:true}]};},async collect(){},async cleanup(){events.push('cleanup');return 'removed';}});
 const reviewer=async(p,packet,checks)=>{
  const report=cleanReport(p.snapshot.head);rounds++;
  if(rounds===1)report.requestedChecks=[{id:'precision',reason:'Suspected truncation',falsifies:'Value remains 1.25'}];
  else {assert.equal(checks.at(-1).id,'precision');assert.ok(packet.previousAssessment);report.summary='Executed test refutes truncation suspicion';events.push('reconsider');}
  return {report};
 };
 const result=await runReview(plan,join(f.repo,'runs'),{reviewer,environmentFactory});
 assert.equal(result.run.status,'complete');assert.equal(result.run.usage.sessions,2);assert.deepEqual(events,['precision','reconsider','cleanup']);
 const rejected=await createPlan({...f,level:'L2',environment:'container',maxRounds:1});
 const r=await runReview(rejected,join(f.repo,'runs'),{environmentFactory,reviewer:async p=>({report:{...cleanReport(p.snapshot.head),requestedChecks:[{id:'undeclared',reason:'run arbitrary code',falsifies:'nothing'}]}})});
 assert.equal(r.run.status,'partial');assert.ok(r.run.reasons.some(x=>x.includes('Unavailable')));
});
test('pinned consumer sources retain repository identity and missing pins become coverage gaps',async t=>{
 const f=await fixture(t);const head=(await git(f.repo,['rev-parse','HEAD'])).trim();
 const source={id:'consumer',repository:'fixture/consumer',repo:f.repo,revision:head,role:'consumer',required:true,parent:f.base};
 const p=await createPlan({...f,level:'L2',sources:[source]});
 const packet=await packetFor(p);assert.equal(packet.sources[0].available,true);
 await captureSourceEvidence({findings:[{evidence:[{kind:'source',sourceId:'consumer',path:'value.js',side:'head'}]}]},packet);
 assert.equal(packet.files[0].repository,'fixture/consumer');assert.equal(packet.files[0].revision,head);
 const missing=await inspectSources([{...source,pinPath:'absent-submodule'}],p.snapshot);assert.equal(missing.gaps.length,1);assert.equal(missing.sources[0].available,false);
 const wrong=await inspectSources([{...source,revision:f.base,parent:head}],p.snapshot);assert.match(wrong.gaps[0],/ancestor/);
});
