import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {command} from '../../review/process.mjs';
import {validateProbes,validateProbeResult} from '../../review/probes.mjs';
import {verificationGaps} from '../../review/report.mjs';

test('real production probe distinguishes detection, weak tests, setup errors and invalid mutations',async()=>{
 const collector=(await readFile(new URL('../../review/environments/openelis-check.py',import.meta.url),'utf8')).split('if __name__ == "__main__":')[0];
 const probe=await readFile(new URL('../../review/environments/probe.py',import.meta.url),'utf8');
 const code=collector+'\n'+probe+String.raw`
with tempfile.TemporaryDirectory() as d:
 root=Path(d)/"source";root.mkdir()
 (root/"calc.py").write_text("def total(): return 2\n")
 test_source='''import xml.etree.ElementTree as ET
from pathlib import Path
suite=ET.Element("testsuite");case=ET.SubElement(suite,"testcase",name="total remains two")
code=0
try:
 from calc import total
 assert total()==2, "expected total=2"
except AssertionError as e:
 code=1;ET.SubElement(case,"failure",message=str(e))
except Exception as e:
 code=2;ET.SubElement(case,"error",message=str(e))
ET.ElementTree(suite).write("result.xml")
raise SystemExit(code)
'''
 (root/"test.py").write_text(test_source)
 check={"id":"total","kind":"test","argv":[sys.executable,"test.py"],"reports":["result.xml"],"timeoutSeconds":2}
 p={"id":"wrong-total","behavior":"keeps total", "path":"calc.py","before":"return 2","after":"return 3","fixedTests":["test.py"],"expectedCase":"total remains two","expectedFailure":"expected total=2"}
 r=execute_probe(p,check,root,"a"*40)
 assert r["outcome"]=="detected",r
 assert r["baseline"]["status"]==r["restored"]["status"]=="pass"
 assert (root/"calc.py").read_text()=="def total(): return 2\n"
 (root/"test.py").write_text(test_source.replace('assert total()==2','assert total() is not None'))
 assert execute_probe(p,check,root,"a"*40)["outcome"]=="survived"
 (root/"test.py").write_text(test_source)
 assert execute_probe({**p,"after":"return ("},check,root,"a"*40)["outcome"]=="setup-error"
 assert execute_probe({**p,"before":"absent"},check,root,"a"*40)["outcome"]=="invalid"
 assert execute_probe({**p,"after":"__import__('time').sleep(4); return 3"},check,root,"a"*40)["outcome"]=="timeout"
 assert execute_probe({"id":"refactor","behavior":"preserves boundary","inapplicableReason":"Approved obsolete consumer removal"},None,root,"a"*40)["outcome"]=="inapplicable"
print("meaningful mutation controls passed")
`;
 const result=await command(['python3','-c',code],{timeoutMs:15000});
 assert.equal(result.code,0,result.stderr);assert.match(result.stdout,/controls passed/);
});
test('a timeout, compile error or arbitrary failing test cannot establish detection',()=>{
 const p={id:'probe',expectedCase:'decimal',expectedFailure:'expected 1.25'};
 const result={id:'probe',head:'h',outcome:'detected',fixedTestsPreserved:true,baseline:{status:'pass'},restored:{status:'pass'},mutant:{outcome:'infrastructure-error',assertions:[]}};
 assert.throws(()=>validateProbeResult(result,p,'h'),/intended assertion/);
 result.mutant={outcome:'assertion-failure',assertions:[{outcome:'assertion-failure',name:'unrelated',detail:'expected 1.25'}]};
 assert.throws(()=>validateProbeResult(result,p,'h'),/intended assertion/);
});
test('test mutation is rejected and behavior evidence requires executed tests plus meaningful probe',()=>{
 const p={id:'probe',behavior:'value',checkId:'test',fixedTests:['test.js'],path:'test.js',before:'2',after:'3',expectedCase:'value',expectedFailure:'wrong'};
 assert.throws(()=>validateProbes([p],[{id:'test',kind:'test'}]),/fixed tests/);
 const report={behaviors:[{behavior:'value',requirement:'preserve',layer:'unit',test:'test.js',assertion:'value is two',gap:'',gapStatus:'none',checkId:'test',probeId:'probe'}]};
 assert.equal(verificationGaps(report,{requiredEvidence:['test-strength']},[],[]).length,2);
 assert.equal(verificationGaps(report,{requiredEvidence:['test-strength']},[{id:'test',kind:'test',status:'pass',executed:1}],[{id:'probe',outcome:'detected'}]).length,0);
});
test('L3 scope exclusions need a reason and do not manufacture tests for unrelated behavior',()=>{
 const plan={requiredEvidence:['test-strength']};
 const report={behaviors:[{behavior:'unchanged mapping',scope:'out-of-scope',applicabilityReason:'Selected question concerns decimal transport only'}]};
 assert.deepEqual(verificationGaps(report,plan,[],[]),[]);
 report.behaviors[0].applicabilityReason='';assert.equal(verificationGaps(report,plan,[],[]).length,1);
});
