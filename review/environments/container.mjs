import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { command, requireSuccess } from '../process.mjs';
import { workerName } from './openelis.mjs';

// Repository code runs without host mounts, network, credentials, Docker socket,
// root privileges or writable root filesystem. Only this run's tmpfs is writable.
export class ContainerEnvironment {
  constructor(plan, directory, execute = command) {
    this.plan = plan; this.directory = directory; this.execute = execute;
    this.name = workerName(plan.id); this.owned = false; this.sequence = 0;
  }
  async call(label, argv, options = {}) {
    return requireSuccess(await this.execute(argv, { log: join(this.directory, (++this.sequence) + '-' + label + '.log'), ...options }), label);
  }
  async start(signal) {
    const image = await this.call('image', ['docker','image','inspect',this.plan.image,'--format','{{.Id}}'], {signal});
    this.imageId = image.stdout.trim();
    if (!/^sha256:[0-9a-f]{64}$/.test(this.imageId)) throw new Error('Invalid image identity');
    await this.call('create', ['docker','create','--name',this.name,'--label','code-qa.run=' + this.plan.id,
      '--network','none','--read-only','--cap-drop=ALL','--security-opt','no-new-privileges',
      '--pids-limit','128','--memory','2g','--cpus','2','--user','1000:1000',
      '--tmpfs','/workspace:rw,exec,uid=1000,gid=1000,mode=0700',
      '--tmpfs','/tmp:rw,exec,uid=1000,gid=1000,mode=0700','--workdir','/workspace',this.imageId,'sleep','infinity'], {signal});
    this.owned = true;
    await this.call('start', ['docker','start',this.name], {signal});
    const archive = join(this.directory,'source.tar');
    await this.call('archive', ['git','-C',this.plan.snapshot.repo,'archive','--format=tar','--output='+archive,this.plan.snapshot.head], {signal});
    await this.call('extract', ['docker','exec','-i',this.name,'tar','--no-same-owner','-xf','-','-C','/workspace'], {signal,input:await readFile(archive)});
  }
  async verify(signal) {
    const result = await this.call('identity', ['docker','inspect',this.name,'--format','{{.Image}} {{.State.Running}}'], {signal});
    const passed = result.stdout.trim() === this.imageId + ' true';
    return {id:'isolated-executor',head:this.plan.snapshot.head,status:passed?'pass':'fail',executed:1,measure:'assertions',assertions:[{name:'selected execution image is running',passed}],image:this.imageId};
  }
  async runCheck(check, signal) {
    const script = await readFile(new URL('./openelis-check.py', import.meta.url),'utf8');
    const payload = Buffer.from(JSON.stringify({check,head:this.plan.snapshot.head,root:'/workspace',verifyGit:false,devStack:false})).toString('base64');
    const result = await this.call('check-'+check.id,['docker','exec','-i',this.name,'python3','-',payload],
      {input:script,signal,timeoutMs:(check.timeoutSeconds+30)*1000,maxBytes:16*1024*1024});
    return JSON.parse(result.stdout.trim());
  }
  async runProbe(probe, signal) {
    const collector = (await readFile(new URL('./openelis-check.py', import.meta.url),'utf8')).split('if __name__ == "__main__":')[0];
    const runner = await readFile(new URL('./probe.py', import.meta.url),'utf8');
    const payload = Buffer.from(JSON.stringify({probe,check:this.plan.checks.find(c=>c.id===probe.checkId),head:this.plan.snapshot.head})).toString('base64');
    const script = collector + '\n' + runner + '\nconfig=json.loads(base64.b64decode(sys.argv[1]))\nprint(json.dumps(execute_probe(config["probe"],config.get("check"),Path("/workspace"),config["head"])))';
    const timeout = (this.plan.checks.find(c=>c.id===probe.checkId)?.timeoutSeconds ?? 1) * 3 + 60;
    const result = await this.call('probe-'+probe.id,['docker','exec','-i',this.name,'python3','-',payload],{input:script,signal,timeoutMs:timeout*1000,maxBytes:16*1024*1024});
    return JSON.parse(result.stdout.trim());
  }
  async collect() {
    if (this.owned) await this.call('identity-evidence',['docker','inspect',this.name,'--format','{{json .State}} {{json .HostConfig}}']);
  }
  async cleanup() {
    if (!this.owned) return 'not-created';
    const label = await this.call('ownership',['docker','inspect',this.name,'--format','{{index .Config.Labels "code-qa.run"}}']);
    if (label.stdout.trim() !== this.plan.id) throw new Error('Container ownership changed');
    await this.call('delete',['docker','rm','-f',this.name]);
    return 'removed';
  }
}
