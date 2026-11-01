import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {git} from '../../review/snapshot.mjs';
import {command,requireSuccess} from '../../review/process.mjs';
import {prepareRepository} from '../../review/reviewers/repository.mjs';
import {reviewWithCodex} from '../../review/reviewers/codex.mjs';

async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'review-source-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const repo=join(root,'source');await mkdir(repo);
  await git(repo,['init','-b','main']);await git(repo,['config','user.name','Fixture']);await git(repo,['config','user.email','fixture@example.invalid']);
  await writeFile(join(repo,'consumer.js'),'export const result = 42;\n');
  await git(repo,['add','.']);await git(repo,['commit','-m','source fixture']);
  const head=(await git(repo,['rev-parse','HEAD'])).trim();
  return {root,repo,snapshot:{repo,head,base:head,mergeBase:head}};
}

test('missing promisor blobs stop before AI and become readable after explicit acquisition',async t=>{
  const f=await fixture(t);await git(f.repo,['config','uploadpack.allowFilter','true']);
  const partial=join(f.root,'partial');
  requireSuccess(await command(['git','clone','--filter=blob:none','--no-checkout',pathToFileURL(f.repo).href,partial]),'Fixture clone');
  const before=await git(partial,['count-objects','-v']);
  const snapshot={...f.snapshot,repo:partial},dir=join(f.root,'run');await mkdir(dir);
  let calls=0;
  await assert.rejects(reviewWithCodex({snapshot,historyDepth:1},{sources:[]},[],dir,undefined,async()=>{calls++;throw new Error('Must not start AI');}),/missing Git objects.*Materialize/);
  assert.equal(calls,0);assert.equal(await git(partial,['count-objects','-v']),before);
  assert.match(await readFile(join(dir,'reviewer/repository-error.txt'),'utf8'),/No reviewer was started/);
  // Source acquisition is an explicit operator action, never an implicit broker fetch.
  await git(partial,['show',snapshot.head+':consumer.js']);
  const recovered=join(f.root,'recovered');await mkdir(recovered);
  const bare=await prepareRepository(snapshot,recovered);
  assert.equal(await git(bare,['show','review-head:consumer.js']),'export const result = 42;\n');
});

test('source preparation retains stage and Git diagnostics without URL credentials',async t=>{
  const f=await fixture(t),dir=join(f.root,'failed');await mkdir(dir);
  const snapshot={...f.snapshot,repo:'https://test-user:private-token@example.invalid/repo?access_token=private-query'};
  let failure;
  try {await prepareRepository(snapshot,dir);}catch(error){failure=error;}
  assert.ok(failure);assert.match(failure.message,/source preflight/);assert.match(failure.message,/cannot change to/);
  const log=await readFile(join(dir,'repository-error.txt'),'utf8');
  assert.doesNotMatch(log,/private-token|private-query|test-user/);assert.match(log,/redacted/);
});
