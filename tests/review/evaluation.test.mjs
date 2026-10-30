import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {freezeEvaluation,verifyFreeze,runEvaluation,scoreEvaluation} from '../../review/evaluation/index.mjs';import {REVIEW_AREAS} from '../../review/levels.mjs';
const corpus=JSON.parse(await readFile(new URL('../../examples/evaluation/corpus.json',import.meta.url))),labels=JSON.parse(await readFile(new URL('../../examples/evaluation/labels.json',import.meta.url))),settings=JSON.parse(await readFile(new URL('../../examples/evaluation/settings.json',import.meta.url)));
test('freeze rejects missing targets, corpus drift and premature held-out execution',async()=>{
 assert.throws(()=>freezeEvaluation(corpus,labels,{...settings,targets:null}),/targets/);
 const unsafe=structuredClone(corpus);unsafe.cases[0].after['.git/config']='unsafe';assert.throws(()=>freezeEvaluation(unsafe,labels,settings),/Git metadata/);
 const frozen=freezeEvaluation(corpus,labels,settings);const altered=structuredClone(corpus);altered.cases[0].requirements='changed';assert.throws(()=>verifyFreeze(frozen,altered,labels),/changed/);
 await assert.rejects(runEvaluation(frozen,corpus,labels,'unused',{split:'held-out'}),/independently approved/);
});
test('paired runner uses equal settings, repeated trials and no answer labels in reviewer packets',async t=>{
 const root=await mkdtemp(join(tmpdir(),'eval-'));t.after(()=>rm(root,{recursive:true,force:true}));const seen=[];
 const frozen=freezeEvaluation(corpus,labels,settings);
 const batch=await runEvaluation(frozen,corpus,labels,join(root,'batch'),{reviewer:async(plan,packet)=>{
  assert.ok(!JSON.stringify(packet).includes('precision-loss'));assert.ok(!('labels' in packet));seen.push({arm:plan.reviewMethod,model:plan.model,seconds:plan.reviewSeconds,head:plan.snapshot.head});
  return {report:{schemaVersion:2,head:plan.snapshot.head,summary:'Controlled runner test',coverage:'complete',omissions:[],questions:[],findings:[],assessments:REVIEW_AREAS.map(area=>({area,status:'assessed',reason:'controlled test'}))},usage:{input_tokens:10,output_tokens:5}};
 }});
 assert.deepEqual(JSON.parse(await readFile(join(root,'batch','labels-private.json'),'utf8')),labels);
 assert.deepEqual(JSON.parse(await readFile(join(root,'batch','corpus-private.json'),'utf8')),corpus);
 assert.equal(batch.results.length,8);assert.deepEqual(new Set(seen.map(x=>x.model)),new Set([settings.model]));assert.deepEqual(seen.slice(0,4).map(x=>x.arm),['plain','harness','harness','plain']);
 const adjudication={adjudicator:'independent-fixture',independent:true,rows:batch.results.map(r=>({runId:r.runId,reason:'All findings inspected in controlled test',findings:[]}))};
 const scores=scoreEvaluation(batch,labels,adjudication);assert.equal(scores.scores.harness.misses,2);assert.equal(scores.scores.harness.recall,0);assert.equal(scores.qualityAccepted,false);
 assert.throws(()=>scoreEvaluation(batch,labels,{...adjudication,adjudicator:labels.authoredBy}),/Independent/);
 adjudication.rows.pop();assert.ok(Object.values(scoreEvaluation(batch,labels,adjudication).scores).some(s=>s.unadjudicated.length));
});
test('scoring counts false alarms and harmful repair proposals without promoting provisional labels',()=>{
 const frozen=freezeEvaluation(corpus,labels,settings);
 const batch={freeze:frozen,split:'development',results:['plain','harness'].flatMap(arm=>[
 {arm,caseId:'c01',trial:0,runId:arm+'-valid',status:'complete',elapsedMs:1,usage:{},findings:[{id:'f1',disposition:'actionable'}]},
 {arm,caseId:'c02',trial:0,runId:arm+'-bug',status:'complete',elapsedMs:1,usage:{},findings:[{id:'f2',disposition:'actionable'}]}])};
 const judged={adjudicator:'human-fixture',independent:true,rows:batch.results.map(r=>({runId:r.runId,reason:'inspected',findings:[{id:r.findings[0].id,classification:r.caseId==='c01'?'false-positive':'true-positive',defectId:r.caseId==='c02'?'precision-loss':'',harmfulFix:r.caseId==='c01',reason:'confirmed fixture outcome'}]}))};
 const scores=scoreEvaluation(batch,labels,judged);assert.equal(scores.scores.harness.recall,1);assert.equal(scores.scores.harness.falsePositiveRate,1);assert.equal(scores.scores.harness.harmful,1);assert.equal(scores.qualityAccepted,false);
});
