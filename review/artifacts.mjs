import {mkdir,writeFile,readFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,extname} from 'node:path';
import {sourcePath} from './snapshot.mjs';
export const artifactKinds=['http','readback','trace','screenshot','video','measurement','runtime','text'];
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateArtifactSpecs(specs=[]) {
  if(!Array.isArray(specs)) throw new Error('Artifacts must be an array');
  for(const a of specs) {sourcePath(a.path);if(!artifactKinds.includes(a.kind))throw new Error('Unknown artifact kind');}
}
export async function persistArtifacts(check,directory,head) {
  if(check.head!==head)throw new Error('Artifact candidate mismatch');
  const out=join(directory,'artifacts');await mkdir(out,{recursive:true,mode:0o700});
  const saved=[];
  for(const [index,a] of (check.artifacts ?? []).entries()) {
    sourcePath(a.path);
    if(!artifactKinds.includes(a.kind) || typeof a.base64!=='string')throw new Error('Invalid artifact payload');
    const bytes=Buffer.from(a.base64,'base64');
    if(!bytes.length || bytes.length>20*1024*1024)throw new Error('Artifact empty or too large');
    const sha256=digest(bytes);
    if(a.sha256!==sha256)throw new Error('Artifact transport integrity mismatch');
    const extension=extname(a.path).toLowerCase();
    if(!/^\.[a-z0-9]{1,8}$/.test(extension))throw new Error('Artifact needs a safe extension');
    if(a.kind==='screenshot' && !(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) || bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'))))throw new Error('Screenshot is not PNG or JPEG');
    const id=check.id+'-'+index,file=join(out,id+extension);
    await writeFile(file,bytes,{flag:'wx',mode:0o600});
    saved.push({id,kind:a.kind,sourcePath:a.path,path:file,sha256,bytes:bytes.length,head,checkId:check.id});
  }
  return saved;
}
export async function captureDesigns(designs,directory) {
  const records=[];await mkdir(join(directory,'designs'),{recursive:true,mode:0o700});
  for(const d of designs) {
    if(!['approved','draft','unspecified'].includes(d.approvalStatus) || !/^[a-z][a-z0-9-]{0,63}$/.test(d.id) || !d.authority?.trim() || !d.source?.trim() || !d.revision?.trim())throw new Error('Design needs identity and reference provenance');
    const file=await realpath(d.file),bytes=await readFile(file);
    if(digest(bytes)!==d.sha256)throw new Error('Design changed after planning');
    const target=join(directory,'designs',d.id+extname(file));
    await writeFile(target,bytes,{flag:'wx',mode:0o600});records.push({...d,file:target});
  }
  return records;
}
