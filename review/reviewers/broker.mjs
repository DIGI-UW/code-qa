import {readFile,appendFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';
import {command,requireSuccess} from '../process.mjs';
import {sourcePath} from '../snapshot.mjs';
import {digest} from '../artifacts.mjs';

// The model chooses operations and source IDs, never executable commands or host paths.
// Bare Git objects are read as data; symlink blobs are not followed.
export async function inspect(config, input) {
  const {source='primary',operation,side='head',path='',query='',offset=0,limit=200}=input;
  if(Object.keys(input).some(k=>!['source','operation','side','path','query','offset','limit'].includes(k)))throw new Error('Unknown inspection argument');
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('Invalid page');
  if(!['base','head'].includes(side))throw new Error('Only pinned base/head may be inspected');
  const selected=config.sources.find(s=>s.id===source);if(!selected)throw new Error('Unknown source');
  if(path)sourcePath(path);
  const ref='review-'+side;
  let args;
  switch(operation) {
    case 'diff':args=['diff','--no-ext-diff','--no-textconv','review-base','review-head','--',...(path?[path]:[])];break;
    case 'show':if(!path)throw new Error('show requires path');args=['show','--no-ext-diff','--no-textconv',ref+':'+path];break;
    case 'tree':args=['ls-tree','-r','--name-only',ref,'--',...(path?[path]:[])];break;
    case 'grep':if(typeof query!=='string'||!query.length||query.includes('\0'))throw new Error('grep requires literal query');args=['grep','-n','-F','-e',query,ref,'--',...(path?[path]:[])];break;
    case 'history':args=['log','--format=%H %s','--max-count=1000',ref,'--',...(path?[path]:[])];break;
    default:throw new Error('Unsupported read operation');
  }
  const result=await command(['git','--no-pager','--literal-pathspecs','--git-dir='+selected.path,...args],{
    env:{PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_NO_REPLACE_OBJECTS:'1'},maxBytes:128*1024*1024,timeoutMs:15000,
  });
  if(!(operation==='grep'&&result.code===1))requireSuccess(result,'Source inspection');
  const lines=result.stdout.split('\n');if(lines.at(-1)==='')lines.pop();
  return {source,revision:selected[side],operation,offset,totalLines:lines.length,nextOffset:offset+limit<lines.length?offset+limit:null,
    text:lines.slice(offset,offset+limit).map((s,i)=>(offset+i+1)+': '+s).join('\n')};
}
export async function evidence(config,{id,offset=0,limit=200,...extra}) {
  if(Object.keys(extra).length||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('Invalid evidence request');
  const artifact=config.artifacts.find(a=>a.id===id);if(!artifact)throw new Error('Unknown evidence ID');
  const bytes=await readFile(artifact.path);if(digest(bytes)!==artifact.sha256)throw new Error('Evidence changed');
  if(['screenshot','design'].includes(artifact.kind))return {content:[{type:'image',mimeType:bytes[0]===0xff?'image/jpeg':'image/png',data:bytes.toString('base64')}]};
  if(!['http','readback','measurement','runtime','text'].includes(artifact.kind))return {content:[{type:'text',text:'Binary artifact retained for operator inspection; no text rendering available.'}]};
  const lines=bytes.toString('utf8').split('\n');return {content:[{type:'text',text:JSON.stringify({id,offset,totalLines:lines.length,nextOffset:offset+limit<lines.length?offset+limit:null,text:lines.slice(offset,offset+limit).join('\n')})}]};
}
export const brokerTools=[
 {name:'inspect',annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},description:'Read pinned Git source only. Start with diff. Page through needed source; no total source allowance. No shell, host files, writes or network.',inputSchema:{type:'object',additionalProperties:false,properties:{source:{type:'string'},operation:{type:'string',enum:['diff','show','tree','grep','history']},side:{type:'string',enum:['base','head']},path:{type:'string'},query:{type:'string'},offset:{type:'integer'},limit:{type:'integer'}},required:['operation']}},
 {name:'evidence',annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},description:'Read supplied immutable evidence by ID. Text is paginated; rendered images returned as images.',inputSchema:{type:'object',additionalProperties:false,properties:{id:{type:'string'},offset:{type:'integer'},limit:{type:'integer'}},required:['id']}}
];
export async function serve(config) {
 const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
 for await(const line of lines) {
  let request;
  try {
   request=JSON.parse(line);if(request.id===undefined)continue;
   let result;
   if(request.method==='initialize')result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'code-qa-source',version:'1.0.0'}};
   else if(request.method==='ping')result={};
   else if(request.method==='tools/list')result={tools:brokerTools};
   else if(request.method==='tools/call') {
    try {
     const {name,arguments:args}=request.params;
     if(name==='inspect')result={content:[{type:'text',text:JSON.stringify(await inspect(config,args))}]};
     else if(name==='evidence')result=await evidence(config,args);
     else throw new Error('Unknown tool');
     await appendFile(config.audit,JSON.stringify({tool:name,args,success:true})+'\n',{mode:0o600});
    } catch(error) {result={isError:true,content:[{type:'text',text:error.message}]};await appendFile(config.audit,JSON.stringify({tool:request.params?.name,success:false,error:error.message})+'\n',{mode:0o600});}
   } else throw new Error('Unsupported method');
   process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\n');
  } catch(error) {process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request?.id??null,error:{code:-32600,message:error.message}})+'\n');}
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await serve(JSON.parse(await readFile(process.argv[2],'utf8')));
