import test from 'node:test';
import assert from 'node:assert/strict';
import { command } from '../../review/process.mjs';
test('real verification executor handles pass, assertion failure, stale/zero reports, timeout and escape',async()=>{
  const script = new URL('../../review/environments/openelis-check.py',import.meta.url).pathname;
  const code = String.raw`
import importlib.util, tempfile, pathlib, sys
spec=importlib.util.spec_from_file_location("runner",sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 root=pathlib.Path(d)/"source";root.mkdir()
 (root/"scripts").mkdir();launcher=root/"scripts/dev-stack"
 launcher.write_text("#!/bin/sh\nprintf \"export FHIR_URL='https://localhost:1234'\\nexport QUOTED='a b'\\n\"\n")
 launcher.chmod(0o755)
 def run(code, timeout=3):
  return m.execute_check({"id":"case","kind":"test","argv":[sys.executable,"-c",code],"reports":["results.xml"],"timeoutSeconds":timeout},root,"abc")
 passing='import os;assert os.environ["FHIR_URL"]=="https://localhost:1234";assert os.environ["QUOTED"]=="a b";from pathlib import Path;Path("results.xml").write_text(\'<testsuite><testcase name="actual assertion"/></testsuite>\')'
 assert run(passing)["status"]=="pass"
 failure='from pathlib import Path;Path("results.xml").write_text(\'<testsuite><testcase name="mismatch"><failure message="expected 2"/></testcase></testsuite>\');raise SystemExit(1)'
 r=run(failure);assert r["status"]=="fail" and not r["assertions"][0]["passed"]
 for cmd in ["pass","raise SystemExit(2)",'from pathlib import Path;Path("results.xml").write_text(\'<testsuite><testcase name="skipped"><skipped/></testcase></testsuite>\')']:
  try:run(cmd);raise AssertionError("zero tests accepted")
  except ValueError as e:assert "No executed tests" in str(e)
 try:run("import time;time.sleep(5)",1);raise AssertionError("timeout accepted")
 except ValueError as e:assert "timed out" in str(e)
 outside=pathlib.Path(d)/"outside.xml";outside.write_text("keep")
 (root/"results.xml").symlink_to(outside)
 try:run(passing);raise AssertionError("escape accepted")
 except ValueError as e:assert "escapes" in str(e)
 assert outside.read_text()=="keep"
print("6 executor cases passed")
`;
  const r=await command(['python3','-c',code,script],{timeoutMs:15000});
  assert.equal(r.code,0,r.stderr);assert.match(r.stdout,/6 executor cases passed/);
});
