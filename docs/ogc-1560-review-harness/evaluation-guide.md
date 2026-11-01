# Evaluating review quality

The evaluation runner compares the harness procedure with a plain-review prompt using the same provider/model, source/evidence broker, selected checks, execution environment, time allowance and session count. Trial order alternates to reduce ordering effects. It does not use another model to invent a quality score. Labels and adjudication stay outside the reviewer snapshots and prompts.

1. Prepare a versioned corpus with opaque case IDs, development/held-out splits, requirements and complete before/after file maps. Optional `review` settings supply the same level, checks/probes/scenarios/workflows/designs to both arms. The included seed corpus is source-only: its runtime/design cases inspect verifier/view code, not actual deployment or rendered acceptance. Use collected L4/L5 cases before claiming those evaluation dimensions.
2. Prepare labels separately: defects per case, author, approval status and independent approver. The shipped labels are **provisional implementation fixtures**, not independent ground truth. Have a maintainer inspect and approve them before held-out execution.
3. Set provider, model, effort, seconds, repeated trials and acceptance thresholds before freezing. There is no automatic model escalation.
4. Freeze and run the development split; retain all partial/error outcomes. Improve the procedure using development cases only. Reversion or relabeling requires a new corpus version, not editing a frozen run.
5. A named independent adjudicator classifies each non-refuted finding as true positive, false positive or non-defect suggestion, identifies matched defect IDs, and records harmful repair proposals and rationale. Review suggestions as well as blocking findings. Fill every run row, including those with no findings; missing adjudication remains unscored.
6. Score against the frozen labels. The report includes misses, false positives, false-alarm case rate, harmful proposals, completion, repeatability, elapsed time and recorded provider usage. Unknown monetary cost remains unknown. `qualityAccepted` requires independently approved held-out labels, complete adjudication and the frozen thresholds. A passing development run cannot establish it.

```bash
node review/evaluation/cli.mjs freeze \
  --corpus examples/evaluation/corpus.json --labels examples/evaluation/labels.json \
  --settings examples/evaluation/settings.json --out /durable/evaluation-freeze.json
node review/evaluation/cli.mjs run \
  --freeze /durable/evaluation-freeze.json \
  --corpus examples/evaluation/corpus.json --labels examples/evaluation/labels.json \
  --split development --out /durable/development-run
node review/evaluation/cli.mjs score \
  --evaluation /durable/development-run/evaluation.json \
  --labels examples/evaluation/labels.json \
  --adjudication /durable/completed-adjudication.json --out /durable/scores.json
```

Output destinations must be new; previous evidence is never overwritten. Per-run records survive interruption. Each batch retains private corpus and label copies beside the frozen settings, outside the reviewer snapshots. Local CLI invocations run as operator-authorized development work; no reviews are posted. The seed corpus covers approved removal, weak/wrong-layer tests, consumer mismatch, stale-runtime checks, design divergence in view code, valid refactoring and injected instructions. These demonstrate the runner and scoring mechanics, not broad review reliability.
