import {readFile} from 'node:fs/promises';
export async function probeProgram(plan,probe,root) {
  const collector=(await readFile(new URL('./openelis-check.py',import.meta.url),'utf8')).split('if __name__ == "__main__":')[0];
  const runner=await readFile(new URL('./probe.py',import.meta.url),'utf8');
  const check=plan.checks.find(c=>c.id===probe.checkId);
  const payload=Buffer.from(JSON.stringify({probe,check,head:plan.snapshot.head,root})).toString('base64');
  const input=collector+'\n'+runner+'\nconfig=json.loads(base64.b64decode(sys.argv[1]))\nroot=Path(config["root"]).expanduser()\nprint(json.dumps(execute_probe(config["probe"],config.get("check"),root,config["head"])))';
  return {payload,input,timeoutMs:((check?.timeoutSeconds ?? 1)*3+60)*1000,maxBytes:16*1024*1024};
}
