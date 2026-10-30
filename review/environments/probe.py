# Appended to the trusted check collector; source is copied into disposable variants.
import hashlib
import shutil
import tempfile

def execute_probe(probe, spec, root, head, dev_stack=False):
    result = {"id": probe["id"], "head": head, "behavior": probe["behavior"]}
    if probe.get("inapplicableReason"):
        return {**result, "outcome": "inapplicable", "reason": probe["inapplicableReason"]}
    root = root.resolve()
    paths = [probe["path"], *probe["fixedTests"]]
    originals = {}
    for name in paths:
        path = root / name
        if not path.resolve().is_relative_to(root) or path.is_symlink() or not path.is_file():
            return {**result, "outcome": "invalid", "reason": "Probe path is not a regular owned file"}
        originals[name] = path.read_bytes()
    production = originals[probe["path"]].decode()
    if production.count(probe["before"]) != 1:
        return {**result, "outcome": "invalid", "reason": "Mutation must match exactly once"}
    result["fixedTestsPreserved"] = True
    with tempfile.TemporaryDirectory(prefix="code-qa-probe-") as directory:
        pristine = Path(directory) / "pristine"
        shutil.copytree(root, pristine, symlinks=True, ignore=shutil.ignore_patterns(".git"))
        for phase in ["baseline", "mutant", "restored"]:
            variant = Path(directory) / phase
            shutil.copytree(pristine, variant, symlinks=True)
            if phase == "mutant":
                (variant / probe["path"]).write_text(production.replace(probe["before"], probe["after"], 1))
            try:
                checked = execute_check(spec, variant, head, dev_stack)
            except Exception as error:
                checked = {"status": "error", "outcome": "infrastructure-error", "reason": str(error)}
            result[phase] = checked
            for name in probe["fixedTests"]:
                if (variant / name).read_bytes() != originals[name]:
                    result["fixedTestsPreserved"] = False
            if phase == "baseline" and checked["status"] != "pass":
                return {**result, "outcome": "timeout" if checked.get("outcome") == "timeout" else "setup-error", "reason": "Corrected candidate did not pass"}
        if not result["fixedTestsPreserved"]:
            return {**result, "outcome": "invalid", "reason": "Test source changed during probe"}
        if result["restored"]["status"] != "pass":
            return {**result, "outcome": "setup-error", "reason": "Restored candidate did not pass"}
        mutant = result["mutant"]
        if mutant["status"] == "error":
            outcome = {"timeout": "timeout", "uncovered": "uncovered"}.get(mutant.get("outcome"), "setup-error")
        elif mutant["status"] == "pass":
            outcome = "survived"
        elif any(a.get("outcome") == "assertion-failure" and a["name"] == probe["expectedCase"] and probe["expectedFailure"] in a["detail"] for a in mutant["assertions"]):
            outcome = "detected"
        else:
            outcome = "uncovered"
        return {**result, "outcome": outcome}
