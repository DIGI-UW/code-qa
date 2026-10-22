"""Offline characterization of the pinned OpenClinAI implementation.

No agent, GitHub request, checkout mutation, deployment, or real test process is run.
The coordinator receives synthetic role outputs; its actual parsing/status code runs.
These observations characterize the reference, not the proposed harness.
"""
import argparse
from contextlib import redirect_stdout
from io import StringIO
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", required=True, type=Path, help="OpenClinAI source at the documented commit")
parser.add_argument("--output", required=True, type=Path, help="Directory for synthetic run records")
args = parser.parse_args()
ROOT = args.output.resolve()
ROOT.mkdir(parents=True, exist_ok=True)
SOURCE = args.source.resolve()
sys.path.insert(0, str(SOURCE / "review/lib"))
from reviewkit.probes import Run, _expect_red, _expect_green

spec = importlib.util.spec_from_file_location("reference_review", SOURCE / "review/bin/review.py")
driver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(driver)

observations = []
def observe(name, expected, actual):
    assert actual == expected, (name, expected, actual)
    observations.append({"case": name, "observed": actual})

log = ROOT / "synthetic-no-command-executed.log"
observe("build_error_counts_as_red", True, _expect_red(Run(2, 0, [], log), "a"*7, "mutation")[0])
observe("zero_tests_explicit_status_rejected", False, _expect_red(Run(3, 0, [], log), "a"*7, "mutation")[0])
observe("exit_zero_without_tests_counts_as_green", True, _expect_green(Run(0, 0, [], log), "a"*7)[0])

head = "a" * 40
def run_case(name, answer):
    work = ROOT / "validation-output" / name
    out = work / "querystore-1"
    out.mkdir(parents=True, exist_ok=True)
    (out / "threads.json").write_text(json.dumps({"base": "main", "author": "fixture", "head_branch": "fix"}))
    argv = ["review.py", "--pr", "1", "--repo", "querystore", "--checkout", str(SOURCE), "--agent", "human", "--no-consumer"]
    with patch.object(sys, "argv", argv), patch.object(driver, "work_dir", return_value=work), \
         patch.object(driver, "upstream", return_value=("origin", "fixture/repo")), \
         patch.object(driver, "fetch_pr", return_value=head), patch.object(driver, "worktree"), \
         patch.object(driver.subprocess, "run", return_value=SimpleNamespace(returncode=0)), \
         patch.object(driver, "run_role", return_value="```json\n" + json.dumps(answer) + "\n```"), \
         redirect_stdout(StringIO()) as captured:
        status = driver.main()
    record = json.loads((out / "findings-1.json").read_text())
    (out / "coordinator-stdout.txt").write_text(captured.getvalue())
    return status, record

blocker = {"file": "calc.py", "line": 1, "finding": "Synthetic finding", "failure_mode": "Synthetic impact", "evidence": "an unverified string", "blocking": True}
status, result = run_case("blocking", {"head": head, "findings": [blocker]})
observe("unresolved_blocker_exit_status", 0, status)
observe("unverified_evidence_string_keeps_blocking", True, result["findings"][0]["blocking"])
status, result = run_case("missing_findings", {"head": head})
observe("missing_findings_field_exit_status", 0, status)
observe("missing_findings_field_becomes_empty", [], result["findings"])
status, result = run_case("stale_head", {"head": "b"*40, "findings": []})
observe("stale_reviewer_head_exit_status", 0, status)
observe("stale_reviewer_head_overwritten", head, result["head"])

(ROOT / "reference-validation.json").write_text(json.dumps({"source_commit": "26d0e53b24c6cb899370ee5c69c800b2f17020e1", "scope": "offline function and coordinator characterization with external operations stubbed", "observations": observations}, indent=2) + "\n")
print(json.dumps(observations, indent=2))
