import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {digest} from '../artifacts.mjs';
import {sourcePath} from '../snapshot.mjs';
import {command,requireSuccess} from '../process.mjs';
import {createPlan} from '../plan.mjs';
import {runReview} from '../run.mjs';
const fingerprint=value=>digest(Buffer.from(JSON.stringify(value)));
const json=(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
export function freezeEvaluation(corpus,labels,settings) {
 if(corpus.version!==1||labels.version!==1||!corpus.cases?.length)throw new Error('Versioned cases and labels required');
 const ids=new Set();
 for(const c of corpus.cases) {
  if(!/^[a-z0-9-]+$/.test(c.id)||ids.has(c.id)||!['development','held-out'].includes(c.split))throw new Error('Unique case ID and split required');ids.add(c.id);
  if(!c.requirements?.trim()||!c.before||!c.after)throw new Error('Case needs requirements and before/after files');
  for(const file of [...Object.keys(c.before),...Object.keys(c.after)]) { sourcePath(file); if(file.split('/').some(part=>part.toLowerCase()==='.git'))throw new Error('Fixture cannot write Git metadata'); }
  if(!Array.isArray(labels.cases[c.id]?.defects))throw new Error('Missing independent case label');
 }
 if(Object.keys(labels.cases).some(id=>!ids.has(id)))throw new Error('Labels contain an unknown case');
 if(!settings.adapter||!settings.model||!['low','medium','high'].includes(settings.reasoningEffort)||!Number.isInteger(settings.reviewSeconds)||settings.reviewSeconds<1||settings.reviewSeconds>1800||!Number.isInteger(settings.trials)||settings.trials<2||settings.trials>10)throw new Error('Choose provider/model/effort/time and 2..10 paired trials');
 const targets=settings.targets;
 if(!targets||!['minRecall','maxFalsePositiveRate','maxHarmfulRate','minCompletion'].every(k=>typeof targets[k]==='number'&&targets[k]>=0&&targets[k]<=1))throw new Error('Freeze explicit quality targets before evaluation');
 return {version:1,corpusVersion:corpus.revision,createdAt:new Date().toISOString(),corpusDigest:fingerprint(corpus),labelsDigest:fingerprint(labels),settings:structuredClone(settings)};
}
export function verifyFreeze(frozen,corpus,labels) {
 if(frozen.version!==1||frozen.corpusDigest!==fingerprint(corpus)||frozen.labelsDigest!==fingerprint(labels))throw new Error('Frozen corpus or labels changed; create a new version');
 freezeEvaluation(corpus,labels,frozen.settings);
}
async function materialize(c,root) {
 const repo=join(root,'sources',c.id);await mkdir(repo,{recursive:true,mode:0o700});
 const git=async(...args)=>requireSuccess(await command(['git','-c','core.hooksPath=/dev/null','-C',repo,...args]),'Evaluation fixture').stdout.trim();
 await git('init','--template=');await git('config','user.name','Evaluation fixture');await git('config','user.email','fixture@example.invalid');
 const put=async files=>{for(const [name,text] of Object.entries(files)){await mkdir(dirname(join(repo,name)),{recursive:true});await writeFile(join(repo,name),text);}};
 await put(c.before);await git('add','.');await git('commit','-m','Base');const base=await git('rev-parse','HEAD');
 // Index-based removal avoids executing any fixture-owned cleanup scripts.
 await git('rm','-rf','.');await put(c.after);await git('add','.');await git('commit','--allow-empty','-m','Candidate');const head=await git('rev-parse','HEAD');
 return {repo,base,head};
}
export async function runEvaluation(frozen,corpus,labels,output,{split='development',reviewer,signal}={}) {
 verifyFreeze(frozen,corpus,labels);
 if(!['development','held-out'].includes(split))throw new Error('Unknown evaluation split');
 if(split==='held-out'&&(labels.status!=='independently-approved'||!labels.approvedBy||labels.approvedBy===labels.authoredBy))throw new Error('Held-out execution needs independently approved labels');
 const selected=corpus.cases.filter(c=>c.split===split);if(!selected.length)throw new Error('No selected cases');
 const directory=resolve(output);await mkdir(directory,{mode:0o700});await json(join(directory,'freeze.json'),frozen);
 // Private reproducibility records are outside all reviewer source snapshots.
 await json(join(directory,'corpus-private.json'),corpus);await json(join(directory,'labels-private.json'),labels);
 const results=[];
 for(const c of selected) {
  const snapshot=await materialize(c,directory);
  for(let trial=0;trial<frozen.settings.trials;trial++)for(const arm of trial%2?['harness','plain']:['plain','harness']) {
   if(signal?.aborted)throw new Error('Evaluation cancelled; completed runs retained');
   // Labels, split, scoring rubric and evaluation fixture names never enter reviewer context.
   const plan=await createPlan({...c.review,...snapshot,level:c.review?.level??'L2',application:'targeted',question:c.question??'Review the selected change against the supplied requirements.',requirements:c.requirements,
    adapter:frozen.settings.adapter,model:frozen.settings.model,reasoningEffort:frozen.settings.reasoningEffort,reviewSeconds:frozen.settings.reviewSeconds,environment:c.review?.environment??'none'});
   plan.reviewMethod=arm;
   // Both arms receive identical checks, artifacts, source and budgets. Only procedure text differs.
   const started=Date.now();const result=await runReview(plan,join(directory,'runs'),{reviewer,signal});
   const row={caseId:c.id,trial,arm,runId:plan.id,directory:result.directory,status:result.run.status,assessment:result.run.assessment,findings:result.run.findings??[],usage:result.run.usage,elapsedMs:Date.now()-started};results.push(row);
   await json(join(directory,plan.id+'.json'),row);
  }
 }
 const batch={version:1,freeze:frozen,split,labelStatus:labels.status,results};await json(join(directory,'evaluation.json'),batch);
 await json(join(directory,'adjudication-template.json'),{version:1,adjudicator:'',independent:false,rows:results.map(r=>({runId:r.runId,reason:'',findings:r.findings.filter(f=>f.disposition!=='refuted').map(f=>({id:f.id,classification:'unreviewed',defectId:'',harmfulFix:false,reason:''}))}))});
 return batch;
}
export function scoreEvaluation(batch,labels,adjudication) {
 if(fingerprint(labels)!==batch.freeze.labelsDigest)throw new Error('Scoring labels differ from the frozen labels');
 if(!adjudication.adjudicator?.trim()||adjudication.independent!==true||adjudication.adjudicator===labels.authoredBy)throw new Error('Independent named adjudication required');
 const scores={};
 for(const arm of ['plain','harness']) {
  const rows=batch.results.filter(r=>r.arm===arm);let expected=0,detected=0,falsePositives=0,harmful=0,actionable=0,complete=0,validCases=0,falseAlarmCases=0;
  const missing=[],outcomes=[];
  for(const row of rows) {
   const label=labels.cases[row.caseId];if(!label)throw new Error('Missing scoring case');
   const judged=adjudication.rows.filter(a=>a.runId===row.runId);if(judged.length!==1||!judged[0].reason?.trim()) {missing.push(row.runId);continue;}
   const actual=row.findings.filter(f=>f.disposition!=='refuted'),decisions=judged[0].findings;
   if(new Set(decisions.map(d=>d.id)).size!==decisions.length||decisions.length!==actual.length||decisions.some(d=>!actual.some(f=>f.id===d.id)||!['true-positive','false-positive','non-defect-suggestion'].includes(d.classification)||!d.reason?.trim()||typeof d.harmfulFix!=='boolean'||(d.classification==='true-positive'&&!label.defects.includes(d.defectId)))) {missing.push(row.runId);continue;}
   const found=new Set(decisions.filter(d=>d.classification==='true-positive').map(d=>d.defectId));
   expected+=label.defects.length;detected+=found.size;falsePositives+=decisions.filter(d=>d.classification==='false-positive').length;harmful+=decisions.filter(d=>d.harmfulFix).length;actionable+=actual.length;complete+=row.status==='complete'?1:0;
   if(!label.defects.length){validCases++;if(decisions.some(d=>d.classification==='false-positive'))falseAlarmCases++;}
   outcomes.push({caseId:row.caseId,trial:row.trial,detected:[...found].sort(),falsePositives:decisions.filter(d=>d.classification==='false-positive').length});
  }
  const recall=expected?detected/expected:null,falsePositiveRate=validCases?falseAlarmCases/validCases:null,harmfulRate=actionable?harmful/actionable:0,completion=rows.length?complete/rows.length:0;
  const t=batch.freeze.settings.targets;
  const pairedConsistency=Object.values(outcomes.reduce((groups,o)=>{(groups[o.caseId]??=[]).push(o);return groups;},{})).map(group=>group.every(o=>JSON.stringify(o.detected)===JSON.stringify(group[0].detected)&&o.falsePositives===group[0].falsePositives));
  scores[arm]={runs:rows.length,expected,detected,misses:expected-detected,falsePositives,harmful,recall,falsePositiveRate,harmfulRate,completion,repeatability:pairedConsistency.length?pairedConsistency.filter(Boolean).length/pairedConsistency.length:null,
   elapsedMs:rows.reduce((s,r)=>s+r.elapsedMs,0),usage:rows.map(r=>({runId:r.runId,...r.usage})),unadjudicated:missing,
   meetsTargets:missing.length?null:recall===null||falsePositiveRate===null?null:recall>=t.minRecall&&falsePositiveRate<=t.maxFalsePositiveRate&&harmfulRate<=t.maxHarmfulRate&&completion>=t.minCompletion};
 }
 return {version:1,split:batch.split,labelStatus:labels.status,adjudicator:adjudication.adjudicator,scores,
  qualityAccepted:batch.split==='held-out'&&labels.status==='independently-approved'&&scores.harness.meetsTargets===true};
}
