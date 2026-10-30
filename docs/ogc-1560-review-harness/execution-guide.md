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

## L3: executed tests and test strength

Use `--probes probes.json` with the container executor. A probe declares `id`, `behavior`, `checkId`, `fixedTests`, production `path`, one exact `before`/`after` replacement, `expectedCase` and `expectedFailure`. The executor runs corrected → mutant → restored copies, keeps test source fixed and retains fresh JUnit reports. Assertion failure must match the expected case and diagnostic. Outcomes distinguish detected, survived, uncovered, invalid, setup-error, timeout and explicitly inapplicable probes. A valid removal may supply `inapplicableReason` instead of a mutation. A compile failure is not proof that tests detect the behavior.

The L3 reviewer maps requirements to appropriate test layers, tests, observable assertions and executed check/probe IDs. Scope and gap status are explicit: unrelated behavior does not silently expand a targeted review. Semantic judgments about adequacy remain review judgments; execution and source identity checks cannot prove them automatically.

`examples/java-unit-image` demonstrates a Java 21 executor with the repository's existing JUnit tests. Supply JUnit/Hamcrest jars in its build context; the image contains no repository or credentials. The small launcher records existing tests, without inventing replacement assertions. This example is appropriate for dependency-free units, not framework/persistence integration.

## Requested experiments

`--experiments catalog.json --max-rounds 1` reserves a second reviewer call within the same total review-time allowance. The catalog uses the same check format. The reviewer may request a catalog ID and explain what it would falsify; it cannot supply arbitrary execution commands. The executor runs the check in the isolated environment and supplies the result for reconsideration. Missing authorization, repeated requests and exhausted allowances remain explicit incomplete evidence. Default is zero extra rounds. No automatic model escalation or repair.

## Dependencies and stack sources

`--sources sources.json` attaches only explicitly selected repositories. Each source has a safe `id`, repository identity, absolute local `repo`, full pinned `revision`, role (`dependency`, `consumer`, `stack`) and `required` boolean. Optional `parent` validates stack ancestry; `pinPath` checks the primary candidate's gitlink. Missing required source or mismatched ancestry/pins is a coverage gap, not a code finding. Reviewers inspect these sources read-only and cite repository/revision with `sourceId`. `--history-depth N` explicitly includes needed ancestry; default is the selected revisions only. These checks do not merge or rewrite upstream branches.
