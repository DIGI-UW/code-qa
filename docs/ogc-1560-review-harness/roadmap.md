# OGC-1560 implementation checklist

Updated 30 October 2026. This is the implementation roadmap following the requirements audit of code-qa v0.3 at `853a24d557cc451bce89ca8743fcf52a807de6fb`.

**Status: Stages 1–2 are implemented in part and under acceptance validation; Stage 3 implementation is in progress; Stages 4–5 remain pending.** Version 0.4 delivers the evidence contract and initial report/model-policy changes. Only checked items below are complete. See [validation-v04.json](validation-v04.json); this is not full-stage or review-quality acceptance.

This checklist supersedes the earlier milestone sequence and the interpretation of L1–L5 as effort presets. See the [specification](specification.md), [goals](goals.md), [historical implementation evidence](implementation-status.md), and [20-gap audit](gap-inventory.json). Gap IDs below are stable links to that audit.

## Completion rules

- Work in the listed order. Each stage may use several review-sized commits/PRs, but its exit demonstration must be a working capability.
- Add or update tests with the implementation; remove obsolete expectations. Do not add product machinery merely to preserve outdated tests.
- Check a box only when its evidence exists. Record revision, effective plan/configuration, command, observed result and durable report/artifact location. Mark blocked or inapplicable explicitly with a reason; never count it as a pass.
- Each stage needs a successful example and a negative control that proves it rejects or exposes the corresponding failure.
- Keep level, scope/lens, provider/model, environment and spend settings independent. Cheap Sol settings are a development profile, not a core restriction.
- No arbitrary source-byte cap, silent model escalation, automatic repair, merge, or mandatory application fingerprint gate.
- No broad live-PR pilot until the methods being evaluated are implemented. Controlled fixtures and limited integration tests belong in each stage.

## Target level contract

| Level | Completion evidence |
| --- | --- |
| **L1 — Mechanical verification** | Applicable repository checks: formatting/lint/build/tests and already-authored probes where selected. Record executed/skipped checks, raw results and revisions. No claim that passing tests are adequate or that the change solves the right problem. No automatic full-suite requirement. |
| **L2 — Semantic review** | Accepted intent; diff plus needed surrounding source; approach and boundary review; behavior-to-test assessment; applicable focused checks when needed to substantiate claims, or explicit missing verification; supported findings, counterevidence, questions and omissions. A lightweight review narrows breadth and effort, not the evidence standard for a finding. It does not claim runtime acceptance. |
| **L3 — Verified behavior and test strength** | L2 review plus focused executable checks at the appropriate layer; applicable mutation/revert probes with specific assertion evidence; bounded reviewer-requested experiments; explicit applicability reasons. No contrived red test for a valid refactor/removal. A compile failure, timeout or zero tests is not a successful behavioral probe. |
| **L4 — Running integration review** | L3 methods where applicable; loaded-candidate identity; actual service/database/configuration interactions; relevant persistence, lifecycle, negative and recovery scenarios; retained runtime evidence. Boot/login alone is insufficient. Test the changed scope, without imposing every deployment scenario on every PR. |
| **L5 — Full-stack product acceptance** | L4 runtime evidence plus representative end-to-end journeys, observed user and saved-state outcomes, product/design comparison, rendered screenshots/video/traces, and an acceptance matrix with deviations and gaps. Acceptance applies to the recorded workflows and candidate configuration, not the entire product. Designs define user-visible intent, not engineering ownership. Non-UI comparisons can be inapplicable with a reason. No label-only scenario substitution. |

Scope is independent of level. L1 may execute existing deterministic probes; L2 assesses test adequacy; L3 adds applicable executed test-strength experiments. Claims at every level need appropriate evidence. Approved deletion and behavior-preserving refactoring do not require contrived red tests. L5 acceptance applies to the recorded workflows and candidate configuration, not the entire product.

## Stage checklist

## Stage 1 — Correct the contract without breaking the useful runner

**Deliverable:** Version evidence-based levels; remove the product Sol gate; add intent, coverage and finding dispositions; separate adapters and repository policy; replace obsolete tests/docs.

### G01 — Levels must describe evidence, not duration

- [x] Replace time-based level completion with versioned evidence requirements and capability validation.
- [x] **Acceptance:** Version the level contract and validate its required evidence. A unit test relabeled scenario cannot complete L5. Missing required evidence yields partial/undetermined, not a silently downgraded or fully completed review. Preserve independent scope, model, execution and spending settings.

### G02 — Recover intent, decisions and changed expectations

- [x] Collect accepted intent, linked decisions and changed expectations with source and authority.
- [ ] **Acceptance:** Record relevant intent and decisions with source, author/authority, retrieval time and revision. Keep old/new expectations when a refactor intentionally changes them. A fixture with an approved removal must not recommend rebuilding the removed machinery just to satisfy an old test. Unavailable or conflicting decisions remain explicit questions.

### G03 — Track findings across review rounds

- [x] Add stable finding identities, original revisions and re-review dispositions.
- [ ] **Acceptance:** Re-review classifies prior items as still present, resolved, superseded, declined with a recorded reason, or unverified. Cite current and original evidence. Resolved items stay in private history without duplicate public comments. Reuse evidence only when its source/configuration remains applicable.

### G04 — Make approach and counterevidence review concrete

- [ ] Record ownership, applicable alternatives and counterevidence for consequential approach findings.
- [ ] **Acceptance:** For consequential approach objections, record the intended problem, current owner, actual reachable code/data path and supported consequence, applicable simpler alternative and relevant counterevidence. Disproportionate redesign stays a suggestion unless a demonstrated defect justifies blocking. Test with a tempting duplicated validation fix and a correct boundary-preserving repair.

### G14 — Report coverage, questions and dispositions honestly

- [x] Extend reports with evidence obligations, coverage, questions, counterevidence and dispositions.
- [x] **Acceptance:** Retain execution status separately from assessment. Record assessed behaviors/dimensions, evidence type, unresolved questions, supported/refuted findings and action/disposition independent of severity. Never promote missing evidence to no findings or treat a quotation check as proof of correctness. Completion must be checked against the selected level's evidence obligations.

### G15 — Provider independence and separate development cost policy

- [x] Remove the core Sol/Luna gate; define reviewer capabilities and an independent inexpensive development profile.
- [ ] **Acceptance:** Separate review level, scope/lens, environment, provider/model and execution/spend policy. Keep cheap Sol settings in a development profile. Adapters declare actual source/image/check-request/structured-output/cancellation/usage capabilities and fail clearly when required capabilities are absent. Verify the interface with fake-adapter conformance in this stage. A second real adapter must pass conformance in Stage 4 before claiming portability; it is not a Stage 1 prerequisite. Do not promise currency/token enforcement a provider cannot offer.

### G16 — Make mechanical checks and environments repository-owned

- [x] Separate repository-owned mechanical checks and environments from the generic plan/runner.
- [ ] **Acceptance:** A small repository adapter supplies applicable deterministic commands, setup/readiness/cleanup and evidence collectors. L1 can run selected lint/build/test/probe checks with zero model calls, without booting OpenELIS unnecessarily. Validate a minimal second repository fixture and keep OpenELIS-specific boot logic in its adapter.

### G20 — Correct specifications, examples and tests together

- [ ] Replace obsolete level/model tests and align specification, CLI help, examples and skill entry points.
- [ ] **Acceptance:** Replace obsolete level/model-policy expectations while keeping reliability protections. Align CLI help, examples, spec, status and skill entry points with one contract. Each delivery demonstrates a real capability and its negative control. Label historical L4/L5 runs by the old preset version and actual evidence; do not retroactively claim new-level acceptance.

**First slice evidence:** v0.4 executes L1/L2, rejects unsupported higher-level claims before spend/startup, separates model settings from levels, and reports coverage/questions/dispositions. One low-effort Sol fixture review honored the approved obsolete-test deletion; its report explicitly did not claim tests ran. The fixture's two behavior tests were run separately. The test-quality skill is now loaded, but the structured behavior-to-test map and probe executor remain Stage 2 work.

**Second slice:** decision provenance, GitHub thread/discussion collection, private finding history and a generic isolated container executor are implemented. All 55 deterministic tests pass. A real L1 run executed both boundary tests, made zero model calls and removed its container (run `a93b3b57-6ba7-4eff-9e6d-8a27c308754e`, source `36d2eb43ed7b3de1a47c52cbebd9476c6a5dbf06`). See the [execution guide](execution-guide.md). Full stage acceptance still requires the combined semantic demonstration.

**Remaining acceptance work in Stage 1:** automatic decision/conversation collection (G02), stable re-review identity/history (G03), fuller approach/alternative verification (G04), adapter conformance completion (G15), generic repository execution (G16), and complete example/skill migration (G20).

### Stage 1 exit

- [ ] **Working demonstration and negative controls:** A cheap local review honors an approved removal, preserves unresolved questions and rejects an unsupported L5 claim. L1 makes zero AI calls. Existing reliability tests remain meaningful.
- [ ] Run relevant deterministic regression tests and retain their results; run a bounded real adapter/environment example when the stage requires it.
- [ ] Record acceptance evidence below and update implementation status to distinguish implemented, verified and still missing behavior.

| Evidence field | Record |
| --- | --- |
| Implementation PR/commit | Pending |
| Positive example and effective plan | Pending |
| Negative controls and observed outcomes | Pending |
| Test results and durable artifacts | Pending |
| Remaining limitations / applicability decisions | Pending |

## Stage 2 — Deliver test-quality and stack verification

**Deliverable:** Wire test-adequacy assessment, pinned consumer/stack sources, typed evidence and isolated mutation/revert execution; permit bounded requested checks.

### G05 — Inspect necessary dependencies, consumers and history

- [x] Add trusted collection of necessary pinned dependency/consumer source and relevant ancestry.
- [ ] **Acceptance:** Attach needed dependencies/consumers as pinned read-only sources through trusted collection. Permit bounded ancestry inspection when a claim needs history. Every source citation identifies repository and revision. A missing required dependency produces a question/coverage gap, not an invented conclusion. Keep unrelated source out of the default review.

### G06 — Review the assembled stack and both sides of contracts

- [x] Represent ordered PR stacks, dependency revisions and the assembled candidate.
- [ ] **Acceptance:** Resolve ordered stack/dependency revisions and the assembled state without merging upstream. Compare emitted and consumed contracts and relevant configuration. A fixture with two individually passing layers that fail together must be detected and attributed to the owning layer. Report stale ancestry/pins separately from code findings.

### G07 — Connect test adequacy and test-layer choice to the runner

- [x] Wire right-layer test assessment into review and produce a behavior-to-test map.
- [ ] **Acceptance:** For changed behavior, record the requirement, appropriate test layer, selected test, observable assertion and remaining gap. Pure calculations may use unit tests; persistence/framework behavior needs a real integration path; rendered state needs rendering; a user journey needs the running product. Detect a mock-only test that misses the actual regression, and accept legitimate removal of obsolete tests.

### G08 — Execute meaningful mutation and revert probes

- [x] Implement isolated production-mutation/revert probes with explicit expected assertions and outcome classification.
- [ ] **Acceptance:** Predeclare the behavior, fixed tests, production mutation/revert and expected assertion. Show corrected pass → meaningful faulty variant fails the intended assertion → restored pass, in a disposable workspace. Distinguish survived, uncovered, equivalent/inapplicable, invalid mutation, setup/compile error, timeout and real detection. Cancellation discards mutated state. Refactors/removals may be explicitly inapplicable; never manufacture a red result.

### G09 — Let the reviewer request a falsifying experiment

- [x] Add a bounded reviewer-requested verification loop controlled by the executor.
- [ ] **Acceptance:** Support a bounded inspect → request check → isolated execution → reconsider sequence. The coordinator validates scope, authority, capabilities and execution limits; the model never receives unrestricted execution credentials. If a check cannot run, preserve the exact question/omission. Test a suspected defect that the requested experiment refutes.

### G10 — Represent actual outcomes and evidence types

- [ ] Support typed artifacts and distinguish test cases, assertion failures and infrastructure errors.
- [ ] **Acceptance:** Report test cases as test cases unless assertion counts are known. Preserve assertion failures versus infrastructure errors and links to raw reports. Support typed evidence such as command output, HTTP exchanges, persisted-state readback, browser traces, screenshots/videos and measurements. Validate artifact identity and make necessary evidence available to the reviewer; reuse the existing bundler where useful.

**Implementation evidence:** [validation-v05.json](validation-v05.json) records 62 passing regression tests and real corrected → faulty → restored runs for both a decimal fixture and OpenELIS `BoundedDecimalTest`. The latter executed the three existing JUnit tests unchanged in Java 21. Live model runs remain recorded as partial until the final scope/gap contract demonstration passes. Typed JUnit outcomes/raw reports are implemented; browser/media artifacts are Stage 3 work.

### Stage 2 exit

- [ ] **Working demonstration and negative controls:** One real OpenELIS change demonstrates useful tests and a meaningful mutation; a weak test survives the mutant and is reported; a setup error is inconclusive; a valid refactor is accepted; an incompatible stack contract is caught.
- [ ] Run relevant deterministic regression tests and retain their results; run a bounded real adapter/environment example when the stage requires it.
- [ ] Record acceptance evidence below and update implementation status to distinguish implemented, verified and still missing behavior.

| Evidence field | Record |
| --- | --- |
| Implementation PR/commit | Pending |
| Positive example and effective plan | Pending |
| Negative controls and observed outcomes | Pending |
| Test results and durable artifacts | Pending |
| Remaining limitations / applicability decisions | Pending |

## Stage 3 — Deliver actual L4/L5 product evidence

**Deliverable:** Bind observed services to built artifacts, run appropriate integration/lifecycle cases, then execute one full OpenELIS journey against approved product/design intent with retained media and outcomes.

### G11 — Bind runtime observations to the loaded candidate

- [ ] Bind runtime observations to built and loaded component identities and relevant configuration.
- [ ] **Acceptance:** Record component/dependency revisions, built artifact/image identity, relevant configuration and the identity observed in the running candidate, using repository-appropriate methods. A stale-loaded-artifact fixture must fail even when checkout HEAD and login are correct. Collect this in the harness; do not introduce mandatory application fingerprint gates.

### G12 — Exercise relevant lifecycle and integration behavior

- [ ] Select and execute affected integration/lifecycle scenarios with explicit coverage and applicability.
- [ ] **Acceptance:** Select applicable scenarios from the changed behavior and record why others are inapplicable. Execute real integration paths, saved-state readback and relevant negative/recovery/lifecycle cases. Distinguish fresh installation from upgrade testing. No universal requirement to run every scenario or whole suite for every PR.

### G13 — L5: full-stack product and design acceptance

- [ ] Implement L5 workflow/design comparison and rendered evidence for the assembled candidate.
- [ ] **Acceptance:** Run the assembled candidate with representative synthetic scenarios; map approved workflows and design/mockup references to observed user outcomes. Inspect rendered pages and relevant interactions, error/empty/loading states, permissions and persisted outcomes. Preserve screenshots/video or traces plus functional results and explicit divergences. Mockups define product intent, not engineering ownership. For non-UI work, mark visual comparison inapplicable with a reason; do not fabricate a design reference.

### Stage 3 exit

- [ ] **Working demonstration and negative controls:** A deliberately stale deployment, a wrong persisted result and a visible design/workflow regression each prevent completion. The corrected candidate completes the acceptance matrix. This proves the capability, not every OpenELIS workflow.
- [ ] Run relevant deterministic regression tests and retain their results; run a bounded real adapter/environment example when the stage requires it.
- [ ] Record acceptance evidence below and update implementation status to distinguish implemented, verified and still missing behavior.

| Evidence field | Record |
| --- | --- |
| Implementation PR/commit | Pending |
| Positive example and effective plan | Pending |
| Negative controls and observed outcomes | Pending |
| Test results and durable artifacts | Pending |
| Remaining limitations / applicability decisions | Pending |

## Stage 4 — Prove portability and safe automation

**Deliverable:** Complete a second reviewer adapter, a small non-OpenELIS repository fixture, dedicated review isolation, managed-result exchange and trusted CI/publication integration.

### G17 — Validate isolation before unattended untrusted reviews

- [ ] Isolate the reviewer as well as test execution before enabling unattended untrusted PR reviews.
- [ ] **Acceptance:** Separate trusted collection/publication and model credentials from untrusted source/test execution. Provide a dedicated reviewer sandbox with explicit readable sources and restricted credentials/network. Exercise injected repository instructions, attempted host reads, credential exposure and worker escape/cleanup fixtures before enabling public-fork automation. Never build fork code with privileged pull_request_target credentials.

### G18 — Automated and managed-review integration

- [ ] Implement common CLI/agent/CI/import interfaces and authorized, fresh, deduplicated publication.
- [ ] **Acceptance:** Expose the same protocol through CLI, agent entry points, trusted CI dispatch and imported reports. Preserve external origin, commit, capabilities and omissions. Use current-head checks, run deduplication and finding/thread identity before authorized publication. Review, publication and merging remain separate permissions; no automatic repair or merge.

### Stage 4 exit

- [ ] **Working demonstration and negative controls:** The same contract passes adapter conformance without hardcoded model assumptions; untrusted content cannot read host secrets or publish; stale/duplicate external findings cannot be posted as current verified results.
- [ ] Run relevant deterministic regression tests and retain their results; run a bounded real adapter/environment example when the stage requires it.
- [ ] Record acceptance evidence below and update implementation status to distinguish implemented, verified and still missing behavior.

| Evidence field | Record |
| --- | --- |
| Implementation PR/commit | Pending |
| Positive example and effective plan | Pending |
| Negative controls and observed outcomes | Pending |
| Test results and durable artifacts | Pending |
| Remaining limitations / applicability decisions | Pending |

## Stage 5 — Measure review quality before a broader PR pilot

**Deliverable:** Run the implemented methods against labeled development and held-out cases; compare with a plain-review baseline and record adjudicated errors and costs.

### G19 — Evaluate review quality, not just runner reliability

- [ ] Build and execute a labeled review-quality evaluation with a baseline and held-out cases.
- [ ] **Acceptance:** Build a small versioned corpus of independently labeled defective and valid changes. Include approved deletion, weak tests, wrong-layer tests, consumer mismatch, stale runtime and design divergence. Freeze held-out cases, compare with a plain-review baseline under equal model/tool/spend settings, repeat trials and have maintainers adjudicate. Record misses, false positives, harmful fix proposals, coverage, cost and latency. Keep expected answers out of review inputs.

### Stage 5 exit

- [ ] **Working demonstration and negative controls:** Publish measured misses, false alarms, harmful repair suggestions, coverage and repeatability. Set acceptance targets before held-out execution. Only then make claims about effectiveness on live PR campaigns.
- [ ] Run relevant deterministic regression tests and retain their results; run a bounded real adapter/environment example when the stage requires it.
- [ ] Record acceptance evidence below and update implementation status to distinguish implemented, verified and still missing behavior.

| Evidence field | Record |
| --- | --- |
| Implementation PR/commit | Pending |
| Positive example and effective plan | Pending |
| Negative controls and observed outcomes | Pending |
| Test results and durable artifacts | Pending |
| Remaining limitations / applicability decisions | Pending |

## Constraints and reference mapping

- **Stages 1–2:** Daniel's approach/intent/consumer review and OpenClinAI's executed probes inform the method. Reuse their techniques, not their entire orchestration or numerical level mapping.
- **Stage 3:** Daniel's runtime verifier supports loaded-artifact verification. L5 design/mockup acceptance is an explicit user requirement. Product designs define visible workflows and interaction intent, not APIs, persistence or engineering ownership.
- **Stage 4:** A second adapter proves portability; a small second repository fixture proves the core is not OpenELIS-specific. Safe automation is required before unattended untrusted inputs, not a reason to block controlled local fixture work.
- **Stage 5:** Fix labels, scoring and acceptance thresholds before held-out execution. Measure missed defects, false positives, harmful repair suggestions, coverage, repeated-run consistency, usage and latency. Compare under equivalent model/tool/spend conditions.
- Do not import automatic convergence loops, organization-wide blocking hooks, blanket bans on test changes, clinical/model-specific evaluation requirements or shared-worktree mutations.

Primary sources:

- [OpenClinAI PR #18 — pinned review process](https://github.com/pmanko/openclinai.org/blob/26d0e53b24c6cb899370ee5c69c800b2f17020e1/specs/review-process.md)
- [Daniel's QueryStore review procedure](https://github.com/openmrs/openmrs-module-querystore/blob/72df9d938b1996bc3eb2f073adb0cea958ee9d1e/.claude/skills/pr-review/SKILL.md)
- [Daniel's runtime verifier](https://github.com/openmrs/openmrs-module-querystore/blob/72df9d938b1996bc3eb2f073adb0cea958ee9d1e/.claude/skills/pr-harden/verifier.md)
- [OpenClinAI stack-review brief](https://github.com/pmanko/openclinai.org/blob/26d0e53b24c6cb899370ee5c69c800b2f17020e1/review/briefs/stack.md)
- [ChartSearchAI project guidance](https://github.com/openmrs/openmrs-module-chartsearchai/blob/dc31cf2a1a7829a7498be2c18d0d44d313b3885a/CLAUDE.md)
- [PIT — mutation outcomes and equivalent mutations](https://pitest.org/quickstart/basic_concepts/)
- [Anthropic — evaluating agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)
- [GitHub — safe pull_request_target use](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)

The [research record](research-and-validation.md) documents reference implementation defects we must not copy. Current and original evidence for each gap is in [gap-inventory.json](gap-inventory.json).
