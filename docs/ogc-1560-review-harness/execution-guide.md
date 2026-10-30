# Running a review

Create a plan before execution. Plans pin source revisions and retain effective settings. The base revision's `.code-qa.json` or an explicit operator `--config` supplies execution commands; PR prose cannot authorize commands.

## Mechanical checks without OpenELIS

Pull a trusted execution image once (`docker pull node:22-bookworm`), then use `--level L1 --environment container --checks checks.json`. The image must have Python 3 for the trusted result collector and the tools needed by the checks. `--image` selects it independently of review level. The run records the resolved image identity.

```json
[
  {"id":"syntax","kind":"command","argv":["node","--check","src/index.mjs"],"reports":[],"timeoutSeconds":30},
  {"id":"behavior","kind":"test","argv":["node","--test","--test-reporter=junit","--test-reporter-destination=results.xml","test.mjs"],"reports":["results.xml"],"timeoutSeconds":60}
]
```

The container has no network, host mounts, credentials, Docker socket or root privileges. Only temporary container filesystems are writable. Install required dependencies in the trusted image beforehand. A missing image or dependency is a failed execution, never a clean review. Containers are deleted in the cleanup path, including failed checks. OpenELIS remains a separate `--environment openelis` adapter with an isolated virtual machine and its own startup/readiness logic.

## Accepted decisions and discussion

PR collection retrieves review threads, general comments, reviews and linked issue references. Missing or truncated discussion is recorded as a coverage gap. Discussion is context, not approval: GitHub OWNER/MEMBER association does not make a comment authoritative.

Use `--decisions decisions.json` to designate accepted intent explicitly. Each entry includes `id`, `source`, `author`, `authority`, `retrievedAt`, full `revision`, `status`, `statement`, `previousExpectation` and `replacementExpectation`. Status is `accepted`, `proposed`, `conflicting` or `unavailable`. Preserve both expectations when approving a removal. Conflicting/unavailable decisions prevent a complete semantic review. Source references should point to the actual decision, not a paraphrased PR description.

## Re-review

Pass `--history /previous/run/history.json`. The reviewer reassesses each prior finding as `still-present`, `resolved`, `superseded`, `declined` or `unverified`, retaining original and current evidence. Missing reassessment remains unverified. Evidence is checked against the current source; old report text is not fresh verification. `history.json` is private history, including resolved items; it is not a public comment payload. Nothing is published automatically.

Reviewers can record a consequential approach objection with its problem, reachable path, supported simpler alternative and counterevidence. Suggestions stay separate from actionable defects. These are reviewer judgments; a valid source quotation alone does not prove the conclusion.
