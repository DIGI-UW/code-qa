import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {command} from '../../review/process.mjs';
import {git, packetFor, captureSourceEvidence} from '../../review/snapshot.mjs';
import {collectStack, isStackFresh, stackCoverageGaps} from '../../review/stack.mjs';
import {createPlan, validatePlan} from '../../review/plan.mjs';
import {prepareReview} from '../../review/reviewers/prepare.mjs';
import {inspect} from '../../review/reviewers/broker.mjs';
import {runReview} from '../../review/run.mjs';
import {validateSchema,validateReviewer} from '../../review/report.mjs';
import {publication} from '../../review/exchange.mjs';
import {identifyFindings} from '../../review/history.mjs';
import {cleanReport} from './fixtures.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'stack-review-')), repo = join(root, 'repo');
  t.after(() => rm(root, {recursive: true, force: true}));
  await mkdir(repo);
  const g = async (...args) => (await git(repo, args)).trim();
  await g('init', '-b', 'main'); await g('config', 'user.name', 'Fixture'); await g('config', 'user.email', 'fixture@example.invalid');
  const commit = async (file, text) => {await writeFile(join(repo,file),text); await g('add',file); await g('commit','-m','fixture change'); return g('rev-parse','HEAD');};
  const trunk = await commit('value.mjs', 'export const value = 1;\n');
  await g('switch','-c','first'); const first = await commit('value.mjs','export const value = 2;\n');
  await g('switch','-c','second'); const second = await commit('consumer.mjs','export const consumer = true;\n');
  const url = n => 'https://github.com/example/repo/pull/' + n;
  const graph = {trunk:'main',branches:[{name:'first',head:first,base:trunk,pr:{number:1,url:url(1)}},{name:'second',head:second,base:first,pr:{number:2,url:url(2)}}]};
  const prs = new Map([[1,{number:1,url:url(1),repository:'example/repo',state:'OPEN',headRefName:'first',baseRefName:'main',headRefOid:first,baseRefOid:trunk}], [2,{number:2,url:url(2),repository:'example/repo',state:'OPEN',headRefName:'second',baseRefName:'first',headRefOid:second,baseRefOid:first}]]);
  const calls = [], posts = [];
  const execute = async (argv, options) => {
    calls.push(argv);
    if(argv[1]==='stack') return {code:0,stdout:JSON.stringify(graph)};
    if(argv[1]==='pr') return {code:0,stdout:JSON.stringify(prs.get(Number(argv[3])))};
    if(argv.includes('POST')) {posts.push({argv,body:JSON.parse(options.input)});return {code:0,stdout:'{"id":1}'};}
    return {code:0,stdout:'[[]]'};
  };
  const collect = async url => {const pr=structuredClone(prs.get(Number(url.split('/').at(-1))));return {repo,base:pr.baseRefOid,head:pr.headRefOid,pullRequest:pr};};
  const options = {execute, collect, read: async pr => structuredClone(prs.get(pr.number))};
  const plan = async extra => createPlan({...await collectStack(repo,options), level:'L2', ...extra});
  return {root,repo,g,commit,trunk,first,second,graph,prs,options,execute,calls,posts,plan};
}

const coverage = stack => ['design', ...(stack.selection==='combined' ? stack.layers.map(l=>l.id).concat('combined') : [stack.selection])].map(id=>({id,status:'assessed',reason:'Synthetic protocol assessment; no runtime claim'}));

test('native collection preserves layer ranges and combined candidate without branch mutation', async t => {
  const f=await fixture(t), before=await f.g('status','--porcelain=v1','-b'), plan=await f.plan();
  assert.equal(plan.snapshot.base,f.trunk);assert.equal(plan.snapshot.head,f.second);assert.equal(plan.application,'stack');
  assert.equal(plan.sources[1].base,f.first);assert.equal(plan.sources[1].revision,f.second);
  assert.equal(await f.g('status','--porcelain=v1','-b'),before);
  assert.ok(f.calls.every(a=>a[1]==='stack' && a[2]==='view'));
  assert.throws(()=>validatePlan({...plan,sources:plan.sources.slice(1)}),/source range/);
  const selected=await collectStack(f.repo,{...f.options,layerNumber:1});
  assert.equal(selected.head,f.first);assert.equal(selected.base,f.trunk);
  assert.equal((await createPlan({...selected,level:'L1'})).stack.selection,'pr-1');
});

test('review broker exposes incremental diffs and base-side evidence for attached layers',async t=>{
  const f=await fixture(t), plan=await f.plan(), packet=await packetFor(plan);
  await mkdir(join(f.root,'prepared'));
  const prepared=await prepareReview(plan,packet,[],join(f.root,'prepared'));
  const config=JSON.parse(await readFile(prepared.brokerConfig,'utf8'));
  const first=await inspect(config,{source:'pr-1',operation:'diff'}),second=await inspect(config,{source:'pr-2',operation:'diff'}),combined=await inspect(config,{operation:'diff'});
  assert.match(first.text,/value = 2/);assert.doesNotMatch(first.text,/consumer/);
  assert.match(second.text,/consumer/);assert.doesNotMatch(second.text,/value = 2/);
  assert.match(combined.text,/value = 2/);assert.match(combined.text,/consumer/);
  const report={...cleanReport(f.second),findings:[{title:'Fixture base citation',owner:'first',ownerSourceId:'pr-1',severity:'low',disposition:'actionable',consequence:'Fixture evidence',counterevidence:'Fixture only',alternative:'',evidence:[{sourceId:'pr-1',kind:'source',path:'value.mjs',side:'base',line:1,quote:'export const value = 1;',checkId:''}]}]};
  await captureSourceEvidence(report,packet);validateReviewer(report,packet,[]);
  assert.equal(packet.files[0].revision,f.trunk);
  assert.match(prepared.input,/undo, bypass or duplicate/);
  assert.match(prepared.input,/GitHub comments and review-thread IDs are context/);
  const schema = JSON.parse(await readFile(prepared.schema,'utf8'));
  assert.equal(schema.properties.priorFindings.anyOf[0].maxItems,0);
});

test('moved parent leaves child historically reviewable but never a complete current stack',async t=>{
  const f=await fixture(t);await f.g('switch','first');const moved=await f.commit('value.mjs','export const value = 3;\n');
  f.graph.branches[0].head=moved;f.prs.get(1).headRefOid=moved;f.prs.get(2).baseRefOid=moved;
  const plan=await f.plan({level:'L1'}),packet=await packetFor(plan);
  assert.equal(await isStackFresh(plan,f.execute),true); // Stable snapshot, distinct from ancestry readiness.
  assert.equal(packet.stack.layers[1].includesCurrentParent,false);
  assert.match(packet.omissions.join('\n'),/pr-2: needs restacking/);
  let sessions=0;
  const result=await runReview(plan,join(f.root,'runs'),{freshness:p=>isStackFresh(p,f.execute),reviewer:()=>{sessions++;throw new Error('No AI for L1');}});
  assert.equal(result.run.status,'partial');assert.equal(result.run.assessment,'undetermined');assert.equal(sessions,0);
});

test('freshness checks every layer and topology, not just unchanged top',async t=>{
  const f=await fixture(t),plan=await f.plan();
  assert.equal(await isStackFresh(plan,f.execute),true);
  f.prs.get(1).headRefOid=f.second;
  assert.equal(await isStackFresh(plan,f.execute),false);
  const result=await runReview(plan,join(f.root,'runs'),{freshness:p=>isStackFresh(p,f.execute),reviewer:()=>{throw new Error('Must not spend');}});
  assert.equal(result.run.status,'superseded');assert.equal(result.run.usage.sessions,0);
  f.prs.get(1).headRefOid=f.first;f.graph.branches.pop();
  assert.equal(await isStackFresh(plan,f.execute),false);
});

test('unpublished, mismatched, wrong-order and moving layers cannot masquerade as a collected stack',async t=>{
  const f=await fixture(t),original=structuredClone(f.graph);
  delete f.graph.branches[1].pr;await assert.rejects(collectStack(f.repo,f.options),/published/);
  f.graph.branches=structuredClone(original.branches);f.graph.branches[1].head=f.first;await assert.rejects(collectStack(f.repo,f.options),/published stack differ/);
  f.graph.branches=structuredClone(original.branches);f.prs.get(2).baseRefName='main';await assert.rejects(collectStack(f.repo,f.options),/dependency order/);
  f.prs.get(2).baseRefName='first';await assert.rejects(collectStack(f.repo,{...f.options,read:async pr=>({...f.prs.get(pr.number),headRefOid:f.trunk})}),/moved/);
});

test('restack comparison exposes previous layers and changed parent even for the same child patch',async t=>{
  const f=await fixture(t),previous=await f.plan();
  await f.g('switch','first');const moved=await f.commit('value.mjs','export const value = 3;\n');
  await f.g('switch','second');await f.g('rebase','first');const child=await f.g('rev-parse','HEAD');
  f.graph.branches[0].head=moved;f.graph.branches[1].head=child;f.graph.branches[1].base=moved;
  f.prs.get(1).headRefOid=moved;f.prs.get(2).baseRefOid=moved;f.prs.get(2).headRefOid=child;
  const source=await collectStack(f.repo,f.options);source.stack.previous=previous.stack;
  const plan=await createPlan({...source,level:'L2'}),packet=await packetFor(plan);
  const childChange=packet.stack.comparisons.find(c=>c.id==='pr-2');
  assert.equal(childChange.parentChanged,true);assert.equal(childChange.status,'changed-revisions');assert.match(childChange.rangeDiff,/=/);
  assert.ok(packet.sources.some(s=>s.id==='previous-pr-2' && s.base===f.first));
  assert.match(packet.stack.evidencePolicy,/No automatic reuse/);
});

test('a clean model label cannot hide missing layer review; explicit partial coverage remains partial',async t=>{
  const f=await fixture(t),plan=await f.plan();
  const report=cleanReport(plan.snapshot.head);report.stackCoverage=coverage(plan.stack).filter(c=>c.id!=='pr-1');
  assert.match(stackCoverageGaps(report,plan.stack).join('\n'),/pr-1/);
  const result=await runReview(plan,join(f.root,'runs'),{freshness:p=>isStackFresh(p,f.execute),reviewer:async()=>({report})});
  assert.equal(result.run.status,'partial');assert.equal(result.run.assessment,'undetermined');
  report.stackCoverage=coverage(plan.stack);assert.deepEqual(stackCoverageGaps(report,plan.stack),[]);
  const second=await f.plan();const complete=await runReview(second,join(f.root,'runs'),{freshness:p=>isStackFresh(p,f.execute),reviewer:async()=>({report})});
  assert.equal(complete.run.status,'complete');
  const markdown=await readFile(join(complete.directory,'report.md'),'utf8');assert.match(markdown,/Combined tests do not prove/);
});

test('stack finding publication uses owning PR revision and stops when another layer changes',async t=>{
  const f=await fixture(t),plan=await f.plan(),report={...cleanReport(f.second),stackCoverage:coverage(plan.stack)};
  report.findings=[{title:'Fixture finding',owner:'first',ownerSourceId:'pr-1',severity:'low',disposition:'actionable',consequence:'Fixture effect',counterevidence:'Fixture counterexample considered',alternative:'',evidence:[{sourceId:'pr-1',kind:'source',path:'value.mjs',side:'head',line:1,quote:'export const value = 2;',checkId:''}]}];
  const findings=identifyFindings(report,'example/repo',f.second),run={plan,reviewer:report,findings},ids=findings.map(f=>f.id);
  const preview=await publication(run,{ids,verifiedIds:ids,execute:f.execute});assert.equal(preview.pr,f.prs.get(1).url);assert.equal(preview.head,f.first);assert.equal(f.posts.length,0);
  await publication(run,{ids,verifiedIds:ids,execute:f.execute,authorize:true});assert.equal(f.posts[0].body.commit_id,f.first);assert.match(f.posts[0].argv.join(' '),/pulls\/1\/reviews/);
  f.prs.get(2).baseRefOid=f.trunk;await assert.rejects(publication(run,{ids,verifiedIds:ids,execute:f.execute,authorize:true}),/Stack changed/);assert.equal(f.posts.length,1);
});

test('combined passing code does not prove a separately selected earlier candidate passes',async t=>{
  const f=await fixture(t);
  // The requirement is value === 3. First layer returns 2, later layer repairs it.
  const top=await f.commit('value.mjs','export const value = 3;\n');
  f.graph.branches[1].head=top;f.prs.get(2).headRefOid=top;
  const combined=await f.plan({level:'L1'}),selected=await createPlan({...await collectStack(f.repo,{...f.options,layerNumber:1}),level:'L1'});
  const verify=async plan=>command(['node','--input-type=module'],{input:(await f.g('show',plan.snapshot.head+':value.mjs'))+'\nimport assert from "node:assert/strict"; assert.equal(value,3);'});
  assert.equal((await verify(combined)).code,0);assert.notEqual((await verify(selected)).code,0);
  assert.notEqual(selected.snapshot.head,combined.snapshot.head);
});

test('selected upper layer never promotes lower PR configuration to trusted commands',async t=>{
  const {configurationSnapshot,trustedConfig}=await import('../../review/context.mjs');
  const f=await fixture(t);
  await f.g('switch','first');const changed=await f.commit('.code-qa.json','{"environment":"container","checks":[{"id":"untrusted-parent-command"}]}\n');
  await f.g('switch','second');await f.g('rebase','first');const child=await f.g('rev-parse','HEAD');
  f.graph.branches[0].head=changed;f.graph.branches[1].head=child;f.graph.branches[1].base=changed;
  f.prs.get(1).headRefOid=changed;f.prs.get(2).baseRefOid=changed;f.prs.get(2).headRefOid=child;
  const plan=await createPlan({...await collectStack(f.repo,{...f.options,layerNumber:2}),level:'L1'});
  assert.equal((await trustedConfig(plan.snapshot)).checks[0].id,'untrusted-parent-command');
  assert.deepEqual(await trustedConfig(configurationSnapshot(plan.snapshot,plan.stack)),{});
});

test('native stack publication recognizes an explicitly mapped finding from a prior revision',async t=>{
  const f=await fixture(t),plan=await f.plan(),report=cleanReport(f.second);
  report.findings=[{title:'Updated title',owner:'first',ownerSourceId:'pr-1',severity:'low',disposition:'actionable',consequence:'Fixture effect',counterevidence:'Fixture',alternative:'',evidence:[{sourceId:'pr-1',kind:'source',path:'value.mjs',side:'head',line:1,quote:'export const value = 2;',checkId:''}]}];
  const findings=identifyFindings(report,'example/repo',f.second),ids=findings.map(f=>f.id),oldId='a'.repeat(24);
  const run={plan,reviewer:report,findings,history:{rounds:[{head:f.second,status:'still-present',id:oldId,currentFindingId:findings[0].title}]}};
  const execute=async(argv,options)=>argv[1]==='api' && !argv.includes('POST') ? {code:0,stdout:JSON.stringify([[{id:55,commit_id:f.trunk,body:`<!-- code-qa:${f.trunk}:${oldId} -->`} ]])} : f.execute(argv,options);
  const result=await publication(run,{ids,verifiedIds:ids,authorize:true,execute});
  assert.equal(result.status,'duplicate');assert.equal(result.existing[0].review,55);assert.equal(f.posts.length,0);
});

test('a finding already raised in a GitHub thread stays in that discussion rather than posting again',async t=>{
  const f=await fixture(t);
  f.prs.get(1).conversation={threads:[{id:'known-thread',comments:{nodes:[{url:'https://github.com/example/repo/pull/1#discussion_r1'}]}}]};
  const plan=await f.plan(),report=cleanReport(f.second);
  report.findings=[{title:'Existing concern',owner:'first',ownerSourceId:'pr-1',existingThreadId:'known-thread',severity:'low',disposition:'actionable',consequence:'Fixture effect',counterevidence:'Still present',alternative:'',evidence:[{sourceId:'pr-1',kind:'source',path:'value.mjs',side:'head',line:1,quote:'export const value = 2;',checkId:''}]}];
  const findings=identifyFindings(report,'example/repo',f.second),ids=findings.map(f=>f.id);
  const result=await publication({plan,reviewer:report,findings},{ids,verifiedIds:ids,authorize:true,execute:f.execute});
  assert.equal(result.status,'duplicate');assert.equal(result.existing[0].thread,'known-thread');assert.equal(f.posts.length,0);
  const packet=await packetFor(plan);await captureSourceEvidence(report,packet);
  report.findings[0].existingThreadId='unknown-thread';assert.throws(()=>validateReviewer(report,packet,[]),/unknown owning-PR review thread/);
});


test('provider coverage schema distinguishes stack layers from attached consumers', async t => {
  const f=await fixture(t);
  for (const selection of ['combined','pr-2']) {
    const source=selection==='combined' ? await collectStack(f.repo,f.options) : await collectStack(f.repo,{...f.options,layerNumber:2});
    const plan=await createPlan({...source,level:'L2',sources:[{id:'distribution',repo:f.repo,repository:'example/distribution',revision:f.second,role:'consumer',required:true}]});
    const packet=await packetFor(plan), dir=join(f.root,selection);await mkdir(dir);
    const prepared=await prepareReview(plan,packet,[],dir);
    const schema=JSON.parse(await readFile(prepared.schema,'utf8')).properties.stackCoverage.anyOf[0];
    const expected=selection==='combined'?['design','pr-1','pr-2','combined']:['design','pr-2'];
    assert.deepEqual(schema.items.properties.id.enum,expected);
    validateSchema(expected.map(id=>({id,status:'assessed',reason:'Source trace complete'})),schema);
    assert.throws(()=>validateSchema([{id:'distribution',status:'assessed',reason:'Consumer traced'}],schema),/invalid value/);
    assert.match(prepared.input,/Attached dependency\/consumer source IDs never belong in stackCoverage/);
    assert.match(prepared.input,/scopeNotes records work outside this review/);
    const report={...cleanReport(plan.snapshot.head),stackCoverage:coverage(plan.stack),scopeNotes:['No runtime claim.']};
    report.assessments.find(a=>a.area==='consumers').reason='Traced the attached distribution consumer.';
    const result=await runReview(plan,join(f.root,'runs'),{freshness:p=>isStackFresh(p,f.execute),reviewer:async()=>({report})});
    assert.equal(result.run.status,'complete');
  }
});
