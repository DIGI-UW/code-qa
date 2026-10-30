# Trusted runtime evidence collector. No secrets or clinical data are serialized.
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import zipfile

def run(args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs).strip()

def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def collect(root):
    exports = run([str(root/'scripts/dev-stack'),'env'], cwd=root)
    env={}
    for line in exports.splitlines():
        words=shlex.split(line)
        if words[:1]==['export'] and len(words)==2:
            key,sep,value=words[1].partition('=')
            if sep:env[key]=value
    project=env['COMPOSE_PROJECT_NAME']
    ids=run(['docker','ps','-q','--filter','label=com.docker.compose.project='+project]).splitlines()
    containers=json.loads(run(['docker','inspect',*ids]))
    images=json.loads((root/'.dev-stack/images.json').read_text())
    expected={tag:run(['docker','image','inspect',tag,'--format','{{.Id}}']) for tag in images.values()}
    components=[]
    backend=None
    for container in containers:
        service=container['Config']['Labels'].get('com.docker.compose.service','')
        image=container['Config']['Image']
        if image in expected:
            components.append({'name':service,'method':'built-image versus running-container image','expected':expected[image],'observed':container['Image']})
        if service=='oe.openelis.org':backend=container['Id']
    if len(components)!=len(images) or not backend:raise ValueError('Missing running candidate components')
    war=root/'target/OpenELIS-Global.war'
    with tempfile.TemporaryDirectory() as d:
        destination=Path(d)/'classes'
        subprocess.run(['docker','cp',backend+':/usr/local/tomcat/webapps/OpenELIS-Global/WEB-INF/classes',str(destination)],check=True,capture_output=True)
        with zipfile.ZipFile(war) as archive:
            entries=sorted(p for p in archive.namelist() if p.startswith('WEB-INF/classes/') and p.endswith('.class'))
            if not entries:raise ValueError('No built application classes')
            built=hashlib.sha256();loaded=hashlib.sha256()
            for entry in entries:
                relative=entry.removeprefix('WEB-INF/classes/')
                built.update(relative.encode());built.update(hashlib.sha256(archive.read(entry)).digest())
                loaded.update(relative.encode());loaded.update(hashlib.sha256((destination/relative).read_bytes()).digest())
            components.append({'name':'OpenELIS deployed classes','method':'built WAR class bytes versus deployed Tomcat class bytes','expected':built.hexdigest(),'observed':loaded.hexdigest()})
    # Configuration is identified by digest only. Passwords never enter evidence.
    configuration={str(p.relative_to(root)):digest(p) for p in [root/'.env',root/'.dev-stack/images.json'] if p.is_file()}
    return {'head':run(['git','rev-parse','HEAD'],cwd=root),'components':components,'configuration':configuration,
            'dependencies':run(['git','submodule','status','--recursive'],cwd=root),'project':project}

if __name__=='__main__':
    print(json.dumps(collect(Path.home()/'review/source')))
