import {git,revision} from './snapshot.mjs';
// Product references are located as data; their implementation annotations never
// become engineering requirements. A draft status does not prevent comparison.
export async function discoverOpenELISDesigns(repo,query,ref='HEAD') {
 if(typeof query!=='string'||!query.trim())throw new Error('Supply a workflow, feature or Jira search term');
 const head=await revision(repo,ref),terms=query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
 const index=await git(repo,['show',head+':INDEX.md']);
 const registry=await git(repo,['show',head+':mockup-viewer/src/App.jsx']);
 const files=(await git(repo,['ls-tree','-r','--name-only',head,'--','designs'])).split('\n').filter(Boolean);
 const blocks=registry.split(/\n  \},?\n  \{/);
 const candidates=[];
 for(const path of files.filter(p=>p.endsWith('.md'))) {
  const block=blocks.find(b=>b.includes("specPath: '"+path+"'"))??'';
  const indexLine=index.split('\n').find(l=>l.includes('('+path+')'))??'';
  const haystack=(path+' '+indexLine+' '+block).toLowerCase();const score=terms.filter(t=>haystack.includes(t)).length;
  if(!score)continue;
  const text=await git(repo,['show',head+':'+path]);
  const declared=block.match(/htmlUrl:\s*'([^']+)'/)?.[1];
  const html=declared&&files.includes(declared)?declared:files.includes(path.replace(/\.md$/,'.html'))?path.replace(/\.md$/,'.html'):null;
  candidates.push({path,score,revision:head,title:text.match(/^#\s+(.+)$/m)?.[1]??path,
   status:block.match(/status:\s*'([^']+)'/)?.[1]??text.match(/\*\*Status:\*\*\s*(.+)/i)?.[1]??'unspecified',
   source:`https://github.com/DIGI-UW/openelis-work/blob/${head}/${path}`,mockPath:html,
   published:html?'https://digi-uw.github.io/openelis-work/'+html:'https://digi-uw.github.io/openelis-work/',
   productOnly:true});
 }
 return {repository:'DIGI-UW/openelis-work',revision:head,query,candidates:candidates.sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,10),guidance:'Use the matching repository mock and published gallery. Record source revision and rendered capture. Draft status is context, not a review prerequisite. Ask only if relevant sources genuinely conflict or cannot be located.'};
}
