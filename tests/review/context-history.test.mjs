import test from 'node:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {validateDecisions,decisionGaps} from '../../review/decisions.mjs';
import {identifyFindings,validateHistory,reconcileHistory} from '../../review/history.mjs';
import {collectConversation} from '../../review/github.mjs';
import {ContainerEnvironment} from '../../review/environments/container.mjs';
import {reviewerAdapter} from '../../review/reviewers/index.mjs';
import {cleanReport} from './fixtures.mjs';
const head='a'.repeat(40), next='b'.repeat(40);
const finding={title:'Consumer reinterprets decimals',owner:'consumer',disposition:'actionable',evidence:[{kind:'source',path:'consumer.js',side:'head',line:1,quote:'parseFloat(value)',checkId:''}]};
test('approved removal preserves old and replacement expectations; conflicts remain gaps',()=>{
  const d={id:'remove-duplicate',source:'operator:review',author:'maintainer',authority:'explicit accepted boundary',retrievedAt:new Date().toISOString(),revision:head,status:'accepted',statement:'Producer decides normalization once',previousExpectation:'Consumer parses commas',replacementExpectation:'Consumer accepts canonical decimals'};
  assert.equal(validateDecisions([d])[0].previousExpectation,'Consumer parses commas');
  assert.deepEqual(decisionGaps([d]),[]);
  assert.equal(decisionGaps([{...d,status:'conflicting'}]).length,1);
  assert.throws(()=>validateDecisions([{...d,authority:''}]),/authority/);
});
test('re-review preserves original evidence and reports missing dispositions as unverified',()=>{
  const original=identifyFindings({findings:[finding]},'example/repo',head);
  const history=validateHistory({schemaVersion:1,repository:'example/repo',head,findings:original,rounds:[]});
  const report=cleanReport(next);
  assert.equal(reconcileHistory(history,report,[],'example/repo',next).rounds[0].status,'unverified');
  report.priorFindings=[{id:original[0].id,currentFindingId:'',status:'resolved',reason:'Removed interpretation at consumer boundary',evidence:[{...finding.evidence[0],quote:'save(value)'}]}];
  const reviewed=reconcileHistory(history,report,[],'example/repo',next);
  assert.equal(reviewed.findings[0].originalHead,head);
  assert.deepEqual(reviewed.rounds[0].originalEvidence,finding.evidence);
  assert.equal(reviewed.rounds[0].head,next);
  assert.throws(()=>reconcileHistory(history,report,[],'different/repo',next),/mismatch/);
  report.priorFindings[0].evidence=[];
  assert.throws(()=>reconcileHistory(history,report,[],'example/repo',next),/current evidence/);
});
test('finding identity survives line movement but never carries old evidence forward as current',()=>{
  const before=identifyFindings({findings:[finding]},'example/repo',head)[0];
  const after=identifyFindings({findings:[{...finding,evidence:[{...finding.evidence[0],line:80}]}]},'example/repo',next)[0];
  assert.equal(before.id,after.id);assert.equal(after.evidence[0].line,80);
});
test('GitHub collection paginates and exposes truncated conversations without treating association as authority',async()=>{
  let pages=0;
  const execute=async argv=>{
    if(argv[1]!=='api') return {code:0,stdout:JSON.stringify({comments:[],reviews:[],closingIssuesReferences:[]})};
    pages++;
    const reviewThreads={nodes:[{id:'thread'+pages,comments:{pageInfo:{hasNextPage:pages===1},nodes:[]}}],pageInfo:{hasNextPage:pages===1,endCursor:'next'}};
    return {code:0,stdout:JSON.stringify({data:{repository:{pullRequest:{reviewThreads}}}})};
  };
  const c=await collectConversation({repository:'test/repo',number:1},execute);
  assert.equal(pages,2);assert.equal(c.threads.length,2);assert.equal(c.gaps.length,1);assert.match(c.authority,/context-only/);
});
test('generic executor command policy has no mounts, socket, network or root execution',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'executor-policy-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const calls=[];const image='sha256:'+'f'.repeat(64);
  const plan={id:'12345678-1234-1234-1234-123456789012',image:'node:22-bookworm',snapshot:{repo:'/fixture',head}};
  const env=new ContainerEnvironment(plan,directory,async argv=>{calls.push(argv);if(argv.includes('archive'))await writeFile(join(directory,'source.tar'),'fixture');return {code:0,stdout:argv[1]==='image'?image:''};});
  await env.start();
  const create=calls.find(a=>a[1]==='create');
  assert.equal(create[create.indexOf('--network')+1],'none');
  assert.equal(create[create.indexOf('--user')+1],'1000:1000');
  assert.ok(create.includes('--read-only'));assert.ok(!create.includes('-v'));assert.ok(!create.includes('--mount'));
  assert.ok(!calls.some(a=>a.join(' ').includes('docker.sock')));
});
test('reviewer conformance advertises actual capabilities independently of model choice',()=>{
  const adapter=reviewerAdapter('codex');
  assert.equal(typeof adapter.review,'function');
  adapter.validate({model:'operator-selected-model',reasoningEffort:'low'});
  assert.equal(adapter.capabilities.source,true);
  assert.equal(adapter.capabilities.images,false);
  assert.equal(adapter.capabilities.cancellation,true);
  assert.equal(adapter.capabilities.hardCurrencyLimit,false);
});
