import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {command,requireSuccess} from '../../review/process.mjs';import {createPlan} from '../../review/plan.mjs';import {importReport,publication} from '../../review/exchange.mjs';import {REVIEW_AREAS} from '../../review/levels.mjs';
test('external import preserves omissions and publication requires current head, verified IDs and deduplication',async t=>{
 const repo=await mkdtemp(join(tmpdir(),'exchange-'));t.after(()=>rm(repo,{recursive:true,force:true}));
 const git=async(...a)=>requireSuccess(await command(['git','-C',repo,...a]),'git').stdout.trim();
 await git('init');await git('config','user.name','Fixture');await git('config','user.email','fixture@example.invalid');await writeFile(join(repo,'value.js'),'export const value = 1;\n');await git('add','.');await git('commit','-m','base');const base=await git('rev-parse','HEAD');
 await writeFile(join(repo,'value.js'),'export const value = 0;\n');await git('commit','-am','change');const head=await git('rev-parse','HEAD');
 const plan=await createPlan({repo,base,head,level:'L2'});plan.pullRequest={url:'https://github.com/example/repo/pull/1'};
 const report={schemaVersion:2,head,summary:'Zero replaces required one',coverage:'complete',omissions:[],questions:[],assessments:REVIEW_AREAS.map(area=>({area,status:'assessed',reason:'fixture'})),findings:[{title:'Required value changed',owner:'value',consequence:'Consumer gets zero',severity:'medium',disposition:'actionable',counterevidence:'No alternate path',alternative:'',evidence:[{kind:'source',path:'value.js',side:'head',line:1,checkId:'',quote:'export const value = 0;'}]}]};
 const envelope={schemaVersion:1,origin:{provider:'external',model:'chosen',runId:'one'},capabilities:['source'],omissions:['runtime not run'],report};
 const imported=await importReport(envelope,plan);assert.equal(imported.execution,'external-unverified');assert.deepEqual(imported.omissions,['runtime not run']);
 await assert.rejects(importReport({...envelope,report:{...report,head:base}},plan),/different head/);
 let posts=0,stale=false,prior=[];const execute=async(argv,opts)=>{if(argv[1]==='pr')return {code:0,stdout:JSON.stringify({state:'OPEN',headRefOid:stale?base:head,baseRefOid:base})};if(argv.includes('POST')){posts++;return {code:0,stdout:'{"id":123}'};}return {code:0,stdout:JSON.stringify([prior])};};
 const ids=imported.findings.map(f=>f.id);
 await assert.rejects(publication(imported,{ids,execute}),/operator verification/);
 const preview=await publication(imported,{ids,verifiedIds:ids,execute});assert.equal(preview.status,'preview');assert.equal(posts,0);
 assert.equal((await publication(imported,{ids,verifiedIds:ids,execute,authorize:true})).status,'published');assert.equal(posts,1);
 prior=[{commit_id:head,body:preview.body}];assert.equal((await publication(imported,{ids,verifiedIds:ids,execute,authorize:true})).status,'duplicate');assert.equal(posts,1);
 stale=true;await assert.rejects(publication(imported,{ids,verifiedIds:ids,execute,authorize:true}),/PR changed/);assert.equal(posts,1);
});

test('primary broker source identity is normalized before quote validation',async t=>{
 const root=await mkdtemp(join(tmpdir(),'primary-source-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const git=async(...args)=>requireSuccess(await command(['git','-C',root,...args]),'git').stdout.trim();
 await git('init');await git('config','user.name','Fixture');await git('config','user.email','fixture@example.invalid');await writeFile(join(root,'value.js'),'export const value=1;\n');await git('add','.');await git('commit','-m','base');const head=await git('rev-parse','HEAD');
 const plan=await createPlan({repo:root,base:head,head,level:'L2'});
 const report={schemaVersion:2,head,summary:'Fixture',coverage:'complete',omissions:[],questions:[],assessments:REVIEW_AREAS.map(area=>({area,status:'assessed',reason:'fixture'})),findings:[{title:'Inspection',owner:'fixture',consequence:'Fixture only',severity:'low',disposition:'suggestion',counterevidence:'No defect',alternative:'',evidence:[{kind:'source',sourceId:'primary',path:'value.js',side:'head',line:1,checkId:'',quote:'export const value=1;'}]}]};
 const imported=await importReport({schemaVersion:1,origin:{provider:'test',model:'test',runId:'test'},capabilities:['source'],omissions:[],report},plan);assert.equal(imported.report.findings[0].evidence[0].sourceId,undefined);
});
