import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parsePR,readPR} from './github.mjs';
import {packetFor,captureSourceEvidence,isFresh} from './snapshot.mjs';
import {validateReviewer} from './report.mjs';
import {identifyFindings} from './history.mjs';
import {command,requireSuccess} from './process.mjs';

// External assertions retain their origin; importing does not turn them into
// locally executed tests or operator-verified findings.
export async function importReport(envelope,plan) {
 if(envelope.schemaVersion!==1 || !envelope.origin?.provider || !envelope.origin?.runId || !envelope.origin?.model || !Array.isArray(envelope.capabilities) || !Array.isArray(envelope.omissions))throw new Error('External report needs origin, model, run ID, capabilities and omissions');
 if(envelope.report?.head!==plan.snapshot.head)throw new Error('External report targets a different head');
 if(!await isFresh(plan.snapshot))throw new Error('Import plan is stale');
 const packet=await packetFor(plan);await captureSourceEvidence(envelope.report,packet);
 // No external check claims are trusted as local execution evidence.
 validateReviewer(envelope.report,packet,[]);
 return {schemaVersion:1,origin:envelope.origin,capabilities:envelope.capabilities,omissions:envelope.omissions,
  report:envelope.report,plan,importedAt:new Date().toISOString(),execution:'external-unverified',
  findings:identifyFindings(envelope.report,plan.pullRequest?.repository??plan.snapshot.repo,plan.snapshot.head)};
}
export async function publication(run,{ids,verifiedIds,authorize=false,execute=command}={}) {
 if(!run.plan?.pullRequest)throw new Error('Publication needs a GitHub PR identity');
 const identity=parsePR(run.plan.pullRequest.url);
 if(!Array.isArray(ids)||!ids.length || new Set(ids).size!==ids.length)throw new Error('Select unique finding IDs');
 if(ids.some(id=>!verifiedIds?.includes(id)))throw new Error('Publication needs explicit operator verification of each selected finding');
 const findings=(run.findings??[]).filter(f=>ids.includes(f.id));
 if(findings.length!==ids.length || findings.some(f=>f.disposition!=='actionable'))throw new Error('Only selected actionable findings may be published');
 const head=run.plan.snapshot.head;
 const checkFresh=async()=>{const current=await readPR(identity,execute);if(current.state!=='OPEN'||current.headRefOid!==head||current.baseRefOid!==run.plan.snapshot.base)throw new Error('PR changed; reassess before publishing');};
 await checkFresh();
 const packet=await packetFor(run.plan);
 const report={...(run.reviewer??run.report),findings:findings.map(({id,originalHead,...f})=>f)};
 await captureSourceEvidence(report,packet);validateReviewer(report,packet,run.checks??[]);
 const priorResult=requireSuccess(await execute(['gh','api',`repos/${identity.repository}/pulls/${identity.number}/reviews`,'--paginate','--slurp']),'Read prior reviews');
 const prior=JSON.parse(priorResult.stdout).flat();
 const marker=f=>`<!-- code-qa:${head}:${f.id} -->`;
 const pending=findings.filter(f=>!prior.some(r=>r.commit_id===head&&r.body?.includes(marker(f))));
 const body=pending.map(f=>`${marker(f)}\n**${f.severity}: ${f.title}**\n\n${f.consequence}\n\nOwner: ${f.owner}.\n\nEvidence: ${f.evidence.map(e=>e.kind==='source'?`${e.path}:${e.line} (${e.side}) — ${e.quote}`:`${e.checkId}: ${e.quote}`).join('\n')}\n\nCounterevidence considered: ${f.counterevidence}`).join('\n\n---\n\n');
 const preview={head,pr:identity.url,selected:ids,pending:pending.map(f=>f.id),body,authorized:authorize};
 if(!authorize||!pending.length)return {...preview,status:pending.length?'preview':'duplicate'};
 await checkFresh();
 const response=requireSuccess(await execute(['gh','api',`repos/${identity.repository}/pulls/${identity.number}/reviews`,'--method','POST','--input','-'],{input:JSON.stringify({commit_id:head,event:'COMMENT',body})}),'Publish review');
 return {...preview,status:'published',review:JSON.parse(response.stdout)};
}
