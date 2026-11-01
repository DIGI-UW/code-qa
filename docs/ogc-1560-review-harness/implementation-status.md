# Implementation and validation

## Version 0.6 follow-up — 1 November 2026: campaign reporting

Native stack reviews now constrain generated coverage IDs to the selected layers, and distinguish visible out-of-scope notes from actual missing evidence. Source preparation detects missing Git objects before the reviewer starts and retains the failing stage plus sanitized Git diagnostics. The regression suite has 95 passing tests and all seven skills validate; see [validation-v09.json](validation-v09.json) for the live adapter result. A fresh low-effort Sol L2 review of the four-PR installation stack and its pinned distribution completed with 79 source inspections, valid coverage IDs, visible scope notes and no actionable findings.

The harness supports L1–L5 and native stack coordination, but its eight PRs remain unmerged drafts. Independent held-out quality adjudication and unattended public-fork deployment acceptance remain open in the [roadmap](roadmap.md). Hosted native-stack dispatch and automatic per-layer execution scheduling are separate extensions. Earlier source-review campaigns do not establish L3–L5 acceptance of the analyzer/security changes.


## Version 0.5 — 30 October 2026: implemented methods and explicit acceptance limits

The current implementation supports evidence-based L1–L5, isolated test/probe execution, loaded-runtime verification, rendered product/design comparisons, Codex and Claude source review, managed-result exchange, explicit publication, and paired quality evaluation. Use the [execution guide](execution-guide.md), [evaluation guide](evaluation-guide.md), and [OpenELIS preparation profile](../../examples/openelis/REVIEW.md). The [checklist](roadmap.md) and [current evidence record](validation-v07.json) distinguish implemented tooling from independent quality acceptance. Entries below are historical.

The OpenELIS profile now discovers `openelis-work` repository mockups and their published previews before asking the user. It records revision/provenance; Draft is context, not an approval gate. Designs define visible product intent, never engineering ownership. A reviewed comparison can complete with deviations; that does not mean the product matches the design.

Executed demonstrations include an actual OpenELIS mutation with unchanged JUnit tests, a passing-per-layer/failing-assembled contract fixture, real loaded image/class identity, and a browser edit/save with persisted readback and rendered screenshots/trace. Codex and Claude inspected source through the restricted broker. Claude returned valid but partial semantic reviews; rendered-image conformance is not claimed for it.

The paired development evaluation ran eight reviews using identical settings across plain/harness arms: four complete, four partial. Its labels are provisional, with a potential valid-case requirement ambiguity documented for adjudication. No accuracy, false-positive rate, or superiority claim is justified yet. Maintainers must approve independent labels and adjudicate held-out trials, including real runtime/design cases, before broader quality claims. The evaluator supports those steps; it does not manufacture independent approval.

Manual hosted CI is implemented but requires merging and protected-environment configuration by the owner. Public-fork event automation remains disabled pending deployment security acceptance. Provider executables are trusted; the source/evidence broker restricts agent tools, not arbitrary provider software at the operating-system level. Nothing was merged.

## Version 0.4 — 30 October 2026: Stage 1 in progress

The first implementation slice separates evidence obligations from execution settings. L1/L2 remain usable; L3–L5 return explicit partial results before startup or AI spend because their required verification executors are pending. Reports now preserve coverage, unanswered questions, counterevidence and actionable/suggestion/refuted dispositions. The core model allowlist is removed; a development profile keeps default testing inexpensive. The test-quality procedure is loaded by the reviewer.

The [checklist](roadmap.md) records completed items and remaining Stage 1 work. [Validation evidence](validation-v04.json) includes a bounded live Sol review of an approved-removal fixture, its source patch and two separately executed behavior tests. It is not a quality benchmark or full-stage completion. Plans use schema 4/evidence contract 3; reviewer output uses schema 2. Recreate old plans instead of silently upgrading them.

## Audit correction — 30 October 2026

The [implementation checklist](roadmap.md) is the current roadmap. At the audited v0.3 revision all five remediation stages were pending; progress is recorded above and in that checklist. The [20-gap inventory](gap-inventory.json) records the source-backed audit.

The entries below describe historical runner capabilities. Their L4/L5 labels refer to the old presets, not verified completion of the new evidence-based levels. In particular, executed JUnit/scenario checks do not establish test adequacy, mutation proof or full-stack/design acceptance. The Sol/Luna restriction was present in the audited v0.3 code but was no longer intended product policy. Existing tests validate runner behavior, not review quality.


## Version 0.3 — 29 October 2026

AI reviews now begin with the diff and inspect exact committed source through a
read-only shell in the same session. A fresh bare Git snapshot exposes the base
and head without copying the operator's worktree, hooks, configuration or remotes.
The source-byte cap, full-file prompt packing, automatic neighbor expansion and
their obsolete tests are removed. Explicit context remains an optional hint.
Quoted evidence from newly discovered callers is validated and retained.

L2 still uses one Sol session, low reasoning and 120 seconds. The same model ceiling,
freshness, timeout and partial-result semantics remain. Plan schema 3 and preset 2
require recreating older plans; they are not silently converted. Read-only shell
execution is not a confidentiality boundary for all host reads; hostile-fork review
still needs a dedicated coordinator, as documented in the runner guide.

Validation:

- 39 automated tests cover large-source admission without prompt packing,
  inspection of pinned base/head and unchanged callers, dirty/untracked-file
  exclusion, exact citation validation, model policy, partial/error handling,
  process cancellation and isolated-check cleanup.
- Seven skill definitions validate; whitespace checks pass.
- A real L2 Sol session executed five read-only inspection commands, traced an
  unchanged caller and identified a seeded authorization regression in a 51 KB
  source file. The exact base, head and caller citations validated. This is adapter
  integration evidence, not a model-quality benchmark.
- The first live attempt correctly remained partial because the adapter had
  disabled this Codex installation's code-mode host. Enabling the host fixed
  tool execution; the unsuccessful run is retained locally.

See [selected v0.3 evidence](validation-v03.json). The previous 22-PR campaign's
four partial reviews will be rerun with the pushed implementation; their application
findings and CI state are separate from these harness tests.

## Version 0.2 — 29 October 2026

The current implementation adds parameterized L1–L5, independent application/lens,
trusted base-revision configuration, PR URL collection with freshness checks,
neighboring source discovery, enforced Sol/Luna models and declared isolated
OpenELIS tests/scenarios. The CLI can be installed as `code-qa`; the
[runner guide](../review-runner.md) gives working commands and limits.

Current local validation:

- 37 automated tests passed, including actual subprocess cancellation, timeout,
  stale/zero JUnit rejection, model policy, L4/L5 execution and cleanup.
- All seven skill definitions passed validation.
- A packed installation exposed the CLI and all level presets, and executed an L1 review.
- A live GitHub PR-URL L1 review completed without AI.
- The first L2 review exposed a real process-group cleanup defect. A new regression
  reproduced it before the fix and passed afterward. Exact multiline source quotes
  are now supported; wrong anchors and changed text remain rejected. The original
  rejected model report is retained as unsuccessful evidence. A second L2 run
  completed with valid source-linked output and exposed an abort-during-log-setup
  race; it too was reproduced before fixing and now has a passing regression.
  Neither finding was automatically repaired by the reviewer.
- The first L5 run built isolated OpenELIS at historical commit
  `556f35d6708f28ec32659a9f25a5ab5e80c268a4`, passed three authentication assertions
  and 24 contract tests, then removed its VM. The example FHIR scenario lacked a
  client certificate and failed; that is not workflow acceptance. Its fixture now
  uses only the worker's generated test certificate. The corrected fresh L5 run
  passed all three authentication assertions, 24 contract tests and the FHIR
  create/read/update/delete scenario. One Sol reviewer consumed the source and
  execution evidence and returned a valid, complete report with no findings for
  the selected question. The worker was removed.

Runtime changes are in `933452554216b791a30efc1691677c4871af7b31` and the
cancellation follow-up `5ccc2c3b4cce0cb798ce7d364754d7e4654d2556`. GitHub checks
were queued at this documentation update; local validation is not a CI-green claim.
See [selected v0.2 execution evidence](validation-v02.json).

These are harness integration tests, not current analyzer/AMR stack clearance or
an accuracy benchmark. No application repository was changed. Local L4/L5 use
predeclared checks before one model review; dynamic model-requested probes,
additional adapters, managed-review import/export, automatic publication,
thread/stack/dependency collection and held-out quality evaluation remain later work.

## Version 0.1 — previous validation


22 October 2026. Implemented and pushed as [code-qa PR #2](https://github.com/DIGI-UW/code-qa/pull/2), following the [specification PR #1](https://github.com/DIGI-UW/code-qa/pull/1). Nothing merged. This is a local first version, not the broader model-quality pilot.

## Delivered

- Plan/run/report commands with exact committed revisions, general or targeted scope, explicit limits and retained JSON/Markdown evidence.
- Mechanical execution without AI credentials; separate execution and assessment states; missing/stale/fabricated evidence cannot become a clean review.
- An OpenELIS adapter around the repository's source launcher, inside a disposable Lima worker with its own Docker engine and database.
- One Codex reviewer using captured source and check results, with tools disabled, an explicit model/billing mode, a time limit and recorded token usage.
- One shared review procedure used by the runner and focused skills. Removed the mandatory inversion/multiple-agent workflow and universal additive-rollout policy.

## Executed validation

The tested runtime implementation is `6a7c913353f4dbd6d918178b18f348c184061070`; later changes in this PR record documentation and evidence.

- **25 automated tests passed locally and in [GitHub CI](https://github.com/DIGI-UW/code-qa/actions/runs/39862314818/job/120115805157).** They cover scope/freshness, malformed and invented output, context omissions, startup/check failures, zero assertions, cleanup, process cancellation (including escaped descendants), the actual HTTP authentication response contract and installed skill links.
- **Seven skill definitions passed validation.** The shared skill passed Skill Creator validation; Lima validated the worker configuration; local documentation links resolved.
- **Real OpenELIS startup and checks passed.** PR #4798 at `556f35d6708f28ec32659a9f25a5ab5e80c268a4` built from source with its recorded Bridge/mock dependencies. The empty database initialized and login readiness completed. Valid administrator login, rejection of an incorrect password and the frontend application-root document all passed.
- **The combined environment/reviewer run completed.** One Codex session consumed the captured authentication source and runtime checks and returned a valid scoped report. This checked the integration, not the quality of a full OpenELIS review.
- **Two controlled Codex cases behaved as expected.** A seeded double-conversion defect was identified with matching source quotations. Approved deletion of an unused parser and its obsolete test returned no findings. Inputs and outputs are preserved in the evidence record; these cases are not an accuracy benchmark.
- **Isolation and cleanup were exercised.** Real guest listeners bound to loopback and wildcard addresses were not forwarded to the host. No user filesystem was mounted; macOS supplied only its Rosetta platform share. Cancelling a real shell operation in a second VM removed that worker while preserving the OpenELIS worker. Scoped recovery was also exercised. All review VMs were removed after validation; the host Docker context remained `orbstack`.

See the [selected evidence, fixture source and model outputs](validation-evidence.json). Raw build, runtime and model logs remain in the local durable run directories identified by those run IDs.

Live testing found and fixed three harness issues: Docker group activation, a negative-login probe that expected the wrong response shape, and loopback port forwarding. Cancellation testing also found and fixed output pipes held open by an escaped process. The earlier unsuccessful runs were retained as unsuccessful; OpenELIS application behavior was not changed.

## Manual boundary review and remaining scope

The common runner owns source capture, evidence validation and outcomes. The OpenELIS adapter owns its test setup and probes; the existing OpenELIS launcher owns application startup. The model supplies semantic judgment, without repair or publication authority. Obsolete-test removal remains valid when it follows accepted requirements.

This version uses a fixed authentication smoke, not complete OpenELIS/browser suites or dynamically selected probes. General repository configuration, human/managed-result import, Claude and other adapters, automated GitHub review, cross-repository collection, hard token/currency caps and the held-out quality evaluation remain later work. Linux-host virtualization and hostile-code penetration testing are unverified. See the [runner guide](../review-runner.md) for usage and limits.

## Context and isolated commands follow-up

Added explicit accepted-decision provenance, paginated review-thread collection, private re-review history and generic container execution. Regression: 55 passing tests plus skill validation. Real L1 fixture: two passing behavior tests, zero AI calls, image identity recorded, cleanup removed the container. This is implementation and executor evidence; it does not establish higher-level review quality or completion of Stages 2–5. See [execution guide](execution-guide.md).

## Test-strength implementation

Pinned source/stack context, explicit behavior maps, isolated mutation probes, typed JUnit outcomes and a bounded catalog-only experiment loop are implemented. All 62 regression tests pass. The actual OpenELIS BoundedDecimal tests passed, detected a production mutant at the expected assertion and passed restored. A live Sol review exposed schema/scope issues now covered in the protocol; its historical partial result remains partial. See [validation-v05.json](validation-v05.json). Full runtime/product acceptance is still unverified.
