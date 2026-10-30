import {git,SHA,sourcePath,revision} from './snapshot.mjs';
export function validateSources(sources) {
  if(!Array.isArray(sources)) throw new Error('sources must be an array');
  const ids=new Set();
  for(const s of sources) {
    if(!/^[a-z][a-z0-9-]{0,63}$/.test(s.id) || s.id==='primary' || ids.has(s.id)) throw new Error('Unique source ID required');
    ids.add(s.id);
    if(!s.repository || typeof s.repo!=='string' || !s.repo.startsWith('/') || !SHA.test(s.revision) || !['dependency','consumer','stack'].includes(s.role) || typeof s.required!=='boolean') throw new Error('Source must identify pinned repository, role and applicability');
    if(s.pinPath) sourcePath(s.pinPath);
    if(s.parent && !SHA.test(s.parent)) throw new Error('Invalid stack parent');
  }
  return sources;
}
export async function inspectSources(sources,snapshot) {
  const resolved=[],gaps=[];
  for(const s of sources) {
    try {
      await revision(s.repo,s.revision);
      if(s.parent) {
        const ancestor=(await git(s.repo,['merge-base',s.parent,s.revision])).trim();
        if(ancestor!==s.parent) throw new Error('Stack parent is not an ancestor of candidate');
      }
      if(s.pinPath) {
        const tree=await git(snapshot.repo,['ls-tree',snapshot.head,'--',s.pinPath]);
        if(!tree.startsWith('160000 commit '+s.revision+'\t')) throw new Error('Assembled candidate has a different dependency pin');
      }
      resolved.push({...s,available:true});
    } catch(error) {
      resolved.push({...s,available:false,reason:error.message});
      if(s.required) gaps.push('Required '+s.role+' '+s.id+': '+error.message);
    }
  }
  return {sources:resolved,gaps};
}
