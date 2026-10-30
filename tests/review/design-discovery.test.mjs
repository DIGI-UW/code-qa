import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {git} from '../../review/snapshot.mjs';import {discoverOpenELISDesigns} from '../../review/design-discovery.mjs';
test('OpenELIS guidance discovers pinned and published mocks without treating draft status as missing evidence',async t=>{
 const repo=await mkdtemp(join(tmpdir(),'designs-'));t.after(()=>rm(repo,{recursive:true,force:true}));
 await git(repo,['init']);await git(repo,['config','user.name','Fixture']);await git(repo,['config','user.email','fixture@example.invalid']);
 await mkdir(join(repo,'designs/admin'),{recursive:true});await mkdir(join(repo,'mockup-viewer/src'),{recursive:true});
 await writeFile(join(repo,'INDEX.md'),'| Labels | [spec](designs/admin/labels.md) |');await writeFile(join(repo,'designs/admin/labels.md'),'# Label Presets\n**Status:** Draft\n');await writeFile(join(repo,'designs/admin/labels.html'),'<h1>Label Presets</h1>');
 await writeFile(join(repo,'mockup-viewer/src/App.jsx'),"{ name: 'Labels', specPath: 'designs/admin/labels.md', htmlUrl: 'designs/admin/labels.html', status: 'draft', jira: ['OGC-285'] }");
 await git(repo,['add','.']);await git(repo,['commit','-m','design']);
 const result=await discoverOpenELISDesigns(repo,'OGC-285 label presets');assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].status,'draft');assert.match(result.candidates[0].source,new RegExp(result.revision));assert.equal(result.candidates[0].published,'https://digi-uw.github.io/openelis-work/designs/admin/labels.html');assert.equal(result.candidates[0].productOnly,true);
});
