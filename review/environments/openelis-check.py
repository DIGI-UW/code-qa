# Trusted runner copied into the disposable worker, never imported from PR code.
import base64
import glob
import hashlib
import json
import os
from pathlib import Path
import signal
import shlex
import subprocess
import sys
import xml.etree.ElementTree as ET

def execute_check(spec, root, head, dev_stack=True):
    root = root.resolve()
    def owned(path):
        resolved = Path(path).resolve()
        if not resolved.is_relative_to(root):
            raise ValueError("Check path escapes the isolated source directory")
        return resolved
    cwd = owned(root / spec.get("cwd", ""))
    def reports():
        return sorted({owned(p) for pattern in spec["reports"]
                       for p in glob.glob(str(root / pattern), recursive=True)})
    def artifact_paths():
        return [(owned(p), a["kind"]) for a in spec.get("artifacts", [])
                for p in glob.glob(str(root / a["path"]), recursive=True)]
    for path, kind in artifact_paths():
        path.unlink()
    # A previous build/test's reports cannot establish this invocation's outcome.
    for path in reports():
        path.unlink()
    env = os.environ.copy()
    launcher = root / "scripts/dev-stack"
    if dev_stack and launcher.exists():
        result = subprocess.run([str(launcher), "env"], cwd=root, capture_output=True, text=True, check=True)
        for line in result.stdout.splitlines():
            # dev-stack emits shell-quoted `export NAME=value`; parse data, never eval it.
            words = shlex.split(line)
            if words[:1] == ["export"]:
                words = words[1:]
            if len(words) == 1:
                key, sep, value = words[0].partition("=")
                if sep and key.replace("_", "").isalnum():
                    env[key] = value
    log = Path("/tmp") / ("check-" + spec["id"] + ".log")
    timed_out = False
    with log.open("w") as output:
        process = subprocess.Popen(spec["argv"], cwd=cwd, env=env,
                                   stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = process.wait(timeout=spec["timeoutSeconds"])
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            code = process.returncode
    artifacts, artifact_gaps = [], []
    artifact_bytes = 0
    for declared in spec.get("artifacts", []):
        matching=[(p,k) for p,k in artifact_paths() if k == declared["kind"] and p.match(declared["path"])]
        if not matching:artifact_gaps.append("Missing artifact: " + declared["path"])
        for path,kind in matching:
            data=path.read_bytes()
            if not data or len(data)>20*1024*1024 or artifact_bytes + len(data)>40*1024*1024:
                artifact_gaps.append("Empty or oversized artifact: " + str(path.relative_to(root)));continue
            artifact_bytes += len(data)
            artifacts.append({"path":str(path.relative_to(root)),"kind":kind,"sha256":hashlib.sha256(data).hexdigest(),"base64":base64.b64encode(data).decode()})
    def inconclusive(outcome, reason):
        return {"id": spec["id"], "kind": spec["kind"], "head": head, "status": "error", "outcome": outcome,
                "executed": 0, "measure": "test cases", "exitCode": code, "assertions": [], "reason": reason,
                "artifacts": artifacts, "artifactGaps": artifact_gaps, "logTail": log.read_text(errors="replace")[-4000:]}
    if timed_out:
        return inconclusive("timeout", "Check timed out; behavior unverified")
    if spec["kind"] == "command":
        return {"id": spec["id"], "kind": "command", "head": head, "executed": 1,
                "outcome": "command-pass" if code == 0 else "command-failure", "artifacts": artifacts, "artifactGaps": artifact_gaps, "measure": "commands", "exitCode": code, "status": "pass" if code == 0 else "fail",
                "assertions": [{"name": "command exit status", "passed": code == 0}],
                "logTail": log.read_text(errors="replace")[-4000:], "argv": spec["argv"]}
    assertions, skipped = [], 0
    found = reports()
    for report in found:
        if report.stat().st_size > 10_000_000:
            raise ValueError("JUnit report exceeds evidence limit")
        for case in ET.parse(report).getroot().iter("testcase"):
            if case.find("skipped") is not None:
                skipped += 1
                continue
            failure = case.find("failure")
            error = case.find("error")
            outcome = "infrastructure-error" if error is not None else "assertion-failure" if failure is not None else "pass"
            if error is not None:
                failure = error
            assertions.append({"name": (case.get("classname", "") + "." + case.get("name", "")).strip("."),
                               "passed": failure is None, "outcome": outcome,
                               "detail": "" if failure is None else ((failure.get("message", "") + " " + (failure.text or ""))[:2000]),
                               "report": str(report.relative_to(root))})
    tail = log.read_text(errors="replace")[-4000:]
    if not assertions:
        return inconclusive("uncovered" if code == 0 else "infrastructure-error", "No executed tests in fresh JUnit reports; exit=" + str(code) + "\n" + tail)
    if len(assertions) > 2000:
        raise ValueError("More than 2000 assertions; narrow the selected verification")
    if code != 0 and all(a["passed"] for a in assertions):
        return inconclusive("infrastructure-error", "Command failed outside reported test cases; exit=" + str(code) + "\n" + tail)
    infrastructure = any(a["outcome"] == "infrastructure-error" for a in assertions)
    return {"id": spec["id"], "kind": spec["kind"], "head": head, "executed": len(assertions),
            "outcome": "infrastructure-error" if infrastructure else "pass" if code == 0 and all(a["passed"] for a in assertions) else "assertion-failure",
            "artifacts": artifacts, "artifactGaps": artifact_gaps,
            "rawReports": [{"path": str(p.relative_to(root)), "format": "junit", "text": p.read_text()} for p in found],
            "measure": "test cases", "skipped": skipped, "exitCode": code, "assertions": assertions,
            "status": "error" if infrastructure else "pass" if code == 0 and all(a["passed"] for a in assertions) else "fail",
            "logTail": tail, "argv": spec["argv"]}

if __name__ == "__main__":
    config = json.loads(base64.b64decode(sys.argv[1]))
    root = Path(config.get("root", str(Path.home() / "review/source")))
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip() if config.get("verifyGit", True) else config["head"]
    if head != config["head"]:
        raise ValueError("Worker revision changed")
    print(json.dumps(execute_check(config["check"], root, head, config.get("devStack", True))))
