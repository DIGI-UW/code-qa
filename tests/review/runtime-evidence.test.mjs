import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {digest,persistArtifacts,captureDesigns} from '../../review/artifacts.mjs';
import {assessRuntime,assessScenarios} from '../../review/runtime.mjs';
import {assessAcceptance} from '../../review/acceptance.mjs';
import {codexArgs} from '../../review/reviewers/codex.mjs';
import {command} from '../../review/process.mjs';
const head='a'.repeat(40);
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6iAAAAABJRU5ErkJggg==','base64');
test('loaded artifact mismatch fails despite matching checkout and passing login',()=>{
 const identity={head,components:[{name:'webapp',method:'deployed class bytes',expected:'new',observed:'old'}],configuration:{mode:'fixture'},dependencies:[]};
 assert.equal(assessRuntime(identity,head).status,'fail');
 identity.components[0].observed='new';assert.equal(assessRuntime(identity,head).status,'pass');
 assert.equal(assessRuntime(identity,'b'.repeat(40)).status,'error');
 assert.ok(assessScenarios([{behavior:'saved label',category:'persistence',reason:'changed save path',applicable:true,checkId:'unit'}],[{id:'unit',kind:'test',executed:10,status:'pass'}]).length);
});
test('fresh typed artifacts retain candidate identity and reject altered bytes or paths',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'qa-artifacts-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const artifact={path:'screen.png',kind:'screenshot',sha256:digest(image),base64:image.toString('base64')};
 const saved=await persistArtifacts({id:'journey',head,artifacts:[artifact]},dir,head);
 assert.equal(saved[0].head,head);assert.deepEqual(await readFile(saved[0].path),image);
 await assert.rejects(persistArtifacts({id:'changed',head,artifacts:[{...artifact,sha256:'bad'}]},dir,head),/integrity/);
 await assert.rejects(persistArtifacts({id:'escape',head,artifacts:[{...artifact,path:'../secret.png'}]},dir,head),/Invalid source path/);
});
test('real collector removes stale evidence and reports missing media instead of accepting an old screenshot',async()=>{
 const script=new URL('../../review/environments/openelis-check.py',import.meta.url).pathname;
 const code=String.raw`
import importlib.util,tempfile,sys
from pathlib import Path
s=importlib.util.spec_from_file_location("collector",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 root=Path(d);(root/"screen.png").write_bytes(b"old")
 spec={"id":"workflow","kind":"command","argv":[sys.executable,"-c","pass"],"reports":[],"timeoutSeconds":3,"artifacts":[{"path":"screen.png","kind":"screenshot"}]}
 r=m.execute_check(spec,root,"head",False)
 assert r["status"]=="pass" and r["artifactGaps"]==["Missing artifact: screen.png"] and not r["artifacts"]
 spec["argv"]=[sys.executable,"-c","from pathlib import Path;Path('screen.png').write_bytes(b'fresh')"]
 r=m.execute_check(spec,root,"head",False);assert len(r["artifacts"])==1 and not r["artifactGaps"]
`;
 const result=await command(['python3','-c',code,script]);assert.equal(result.code,0,result.stderr);
});
test('L5 requires persisted results, rendered comparison and a selected design reference; deviations remain visible',()=>{
 const rows=[{id:'save',requirement:'save dimensions',checkId:'workflow',designId:'approved'}];
 const checks=[{id:'workflow',kind:'scenario',status:'pass',executed:1}];
 const artifacts=[{id:'screen',kind:'screenshot',checkId:'workflow'},{id:'stored',kind:'readback',checkId:'workflow'}];
 const designs=[{id:'approved',approvalStatus:'approved'}];
 const answer={id:'save',status:'pass',reason:'Matches selected workflow',observedOutcome:'Saved confirmation',persistedOutcome:'Height reads back as 26',designId:'approved',designComparison:'Editor fields and saved row match reference',artifactIds:['screen','stored']};
 assert.deepEqual(assessAcceptance(rows,{acceptance:[answer]},checks,artifacts,designs),{gaps:[],deviations:[],referenceNotes:[]});
 assert.ok(assessAcceptance(rows,{acceptance:[answer]},checks,artifacts.filter(a=>a.kind!=='readback'),designs).gaps.length);
 const draft=assessAcceptance(rows,{acceptance:[answer]},checks,artifacts,[{id:'approved',approvalStatus:'draft'}]);assert.equal(draft.gaps.length,0);assert.match(draft.referenceNotes[0],/draft/);
 assert.equal(assessAcceptance(rows,{acceptance:[{...answer,status:'fail',reason:'Save button absent'}]},checks,artifacts,designs).deviations.length,1);
});
test('Codex receives actual image attachments, not just descriptions',()=>{
 const args=codexArgs({model:'selected',reasoningEffort:'low'},'/repo','/schema','/out',['/observed.png','/design.png']);
 assert.equal(args.filter(x=>x==='--image').length,2);assert.ok(args.includes('/observed.png'));assert.ok(args.includes('/design.png'));
});
