# Validation matrix: code-qa revamp

22 October 2026. This distinguishes **source-supported design**, **executed reference checks**, and **acceptance tests still to implement**. It does not claim the proposed harness or its model reviewers have passed a pilot.

## User goals covered

| Goal from goals.md | Where the specification addresses it | Acceptance evidence required |
| --- | --- | --- |
| 1: revamp, not bolt-on | Existing-asset disposition table, shared procedure and migration/retirement plan. | New entry points use one rule source; superseded workflows are removed or become routing aliases. |
| 2: general repository use | Core/repository ownership split; one initial environment and three intended adoption repositories. | Same coordinator handles Java, frontend and distribution/configuration cases without analyzer rules in core. |
| 3: automated review | Trusted workflow, eligible PR events, preauthorized policy and idempotent publication. | A PR update starts the selected plan; superseded results cannot publish as current. |
| 4: targeted review | Question/lens/path/range inputs and explicit coverage. | A focused question gets a focused answer and necessary neighbor tracing, without a whole-PR clean claim. |
| 5: parameterized L1–L5 and applications | Independent level/application/lens selection; versioned presets and M3a acceptance. | Resolve each level to explicit limits; L1 uses no AI, L2 uses at most one session, and L4/L5 require executed declared checks/scenarios rather than source-only clearance. |
| 6: no-credit mechanical checks | Separate deterministic checks and model-free default. | Run with no model credentials and a model-call trap; verify zero calls while configured checks execute. |
| 7: chosen AI rigor/budget | Pre-execution plan, declared limits and usage records. | Budget exhaustion produces partial output; unsupported hard limits are rejected; no extra agent/provider is invoked. |
| 8: Codex/Claude/other integration | CLI, CI, skills and managed-review import/export. | Adapter conformance tests plus the same corpus through Codex and Claude; external imports retain unknown capabilities/evidence. |
| 9–10: references, research and validation | Pinned-source audit, primary references, nine executed characterization assertions and pilot protocol. | Held-out trials and human adjudication still required; do not treat reference test results as reviewer accuracy. |
| 11: prevent recreated machinery | Requirement authority, test classification and explicit removal/relocation options. | Both bad duplication and valid removal/refactoring cases graded correctly. |
| 12: honest evidence | Separate execution/assessment, anchored evidence and immutable snapshot. | Reject missing/malformed output, stale revisions and zero-test claims. |
| 13: proportionate adoption | Advisory rollout, existing CI adapters, hooks later, no automatic repair loop. | Pilot records false alarms, missed defects and maintainer time without changing merge authority. |
| 14: persistence | goals.md, specification, research record, validation script/results, Jira and draft PR. | Links resolve and future work has a single documented scope. |
| 15: implement before pilot | M1–M3 deliver a tested local first version; M4 expands integrations; M5 evaluates and pilots. | Working CLI, environment and one AI adapter demonstrated before any real-PR pilot. |
| 16: boot the isolated PR | Explicit environment lifecycle and repository launcher adapter. | Actual reviewed source starts with required services; readiness, scoped probes, retained evidence, concurrent isolation and teardown are verified. |
| 17: Sol-or-lower reviews | Model ceiling independent of level; trusted provider/model allowlists. | Reject disallowed or unknown models before invocation; higher levels, fallback and PR input cannot bypass the ceiling. |

## Comparison with the requested reference systems

| Reference and actual strength | How the revamp uses it | Why it is not copied wholesale |
| --- | --- | --- |
| OpenClinAI L0/L1: static checks and executable regression probes. | Mechanical mode and optional targeted behavior probes. | Build failure is not behavioral proof; valid refactoring need not fail on the old version. |
| OpenClinAI L2: fresh reviewer, carried threads, explicit producer/consumer context. | Shared review packet and scoped fresh sessions. | Replace hardcoded repositories, permissive output parsing and inferred stack membership. |
| OpenClinAI L3–L5: deployed scenarios, preregistered gates and full product evaluation. | Optional repository-defined verification for appropriate risks. | Clinical inference matrices are product-specific; a general PR review must not automatically deploy or run a full product evaluation. |
| OpenClinAI empirical re-review record. | Motivation for scope/neighbor context and a fixture-based evaluation. | Repeated tuning on known misses is not a held-out general benchmark. |
| Daniel's pr-review: approach before line-level polishing, issue/prior-thread context, verified consequences. | Standard review procedure and targeted approach/boundary lens. | Source-proven ownership violations are actionable even without a runtime crash. |
| Daniel's pr-harden: independent roles, recorded declines, verifier and bounded rounds. | Focused verification and an explicit future repair handoff. | Automatic repair/push and Stop-gated session orchestration are outside the review core. |
| Daniel's fan-out experiments and corrected conclusions. | L5 can select additional reviewers; L2/L3 start with one. | Additional findings came with substantial duplication/cost; n=2 is insufficient for a universal policy. |
| code-qa simplicity/spec alignment. | Consolidate their existing requirement and authority reasoning into the common procedure. | Preserve the useful distinctions; don't replace them with vague “code is truth” or “less code is always better.” |
| code-qa meaningful-test-coverage. | Right-level behavior tests and explicit evidence limits. | Retire runtime-specific orchestration as a requirement; apply inversion only to appropriate changes. |
| code-qa companion PR discipline. | Explicit related-repository and delivery contract. | Universal independent/additive rollout would recreate compatibility paths during intentional coordinated cutovers. |
| code-qa evidence/hygiene/install tooling. | Keep deterministic helpers, adapt skill entry points and preserve installation compatibility. | Media evidence is not required for every review; publication follows a preauthorized policy rather than contradictory blanket rules. |

## Manual design challenge using representative cases

This is a desk review of the proposed rules against the inspected procedures, not a blinded model trial.

| Case | Required disposition | What the design must avoid |
| --- | --- | --- |
| Consumer adds new parsing of an already canonical producer value to fix a test. | Trace ownership; flag duplicated interpretation and evaluate whether the test is obsolete. | Improve the consumer parser merely because the test expects it. |
| Approved cutover deletes old fallback and its tests. | Assess accepted target state, delivery order and preserved responsibilities. | Demand an additive compatibility path simply because the existing companion-PR skill says so. |
| Pure extraction/rename passes unchanged behavioral tests. | Accept applicable behavioral evidence; inspect callers and semantics. | Require an artificial failing revert test. |
| A cleanup deletes access control together with obsolete code. | Flag lost authorization using accepted policy and call-path evidence. | Equate deletion with correctness. |
| One targeted question about a migration is answered successfully. | Complete for the migration question; other areas explicitly unreviewed. | Mark the entire PR reviewed or mergeable. |
| A reviewer asks for new machinery without a source-supported consequence. | Keep as an unconfirmed question or decline after investigation. | Automatically create code or a new merge gate. |
| A managed reviewer supplies comments but no test logs/tool transcript. | Import anchored findings with the available evidence; request independent verification if needed. | Call the import a code-qa L4 run or invent test results. |
| Mechanical-only request arrives with no model account. | Execute mechanical path without a model request. | Invoke an LLM to decide whether mechanical checks passed. |
| AI budget expires or provider fails. | Preserve partial findings and explicit reason; no silent escalation. | Produce no-findings/green or switch models and spend more. |
| Runtime review starts an old published image despite changed PR source. | Reject attribution to the PR; build/run the changed components or report the missing verification. | Treat a healthy unrelated build as PR evidence. |
| Stack startup fails before a scenario runs. | Record startup failure, collect logs and clean up owned resources. | Call the scenario passed or treat startup failure as a reproduced behavior defect. |
| Two reviews run concurrently and one is cancelled. | Keep resources and data separate; clean up only the cancelled run and retain its evidence. | Reuse shared database state or stop/prune another run or developer stack. |

## What has actually run

- The current code-qa frontmatter linter: six skills valid.
- Nine deterministic assertions against pinned OpenClinAI probe/coordinator behavior, repeated using the proposed checked-in reproduction script: passed. See `reference-validation.json` and the exact scope described in `research-and-validation.md`.
- The specification was manually checked against the goals and references above. No independent reviewer or live model comparison was run.

## Remaining validation before implementation can claim readiness

1. Implement and test the packet/result schema, outcome state machine, budget handling and adapter capability negotiation.
2. Test mechanical mode with model access disabled; test paid modes with fake adapters that count every call and enforce declared limits.
3. Boot a real fixture application from the reviewed revision using one repository adapter. Test readiness, meaningful passing/failing assertions, startup failure, timeout, cancellation, concurrent isolation and scoped teardown. Confirm source-only mode does not boot the stack.
4. Exercise one real AI adapter for the first usable version, then both Codex and Claude invocation and external-import adapters before the pilot. Verify version-specific structured output, cancellation, ambient-config suppression and available usage accounting.
5. Run adversarial trust-boundary fixtures: hostile PR instructions, changed rule files, fabricated artifacts, symlink escapes, missing dependencies, stale heads and malicious test commands. No secrets/writer token may reach untrusted execution.
6. After the implemented harness passes its acceptance tests, run the held-out reviewer-quality experiment and then the report-only live-PR pilot. Report harmful fix suggestions, false alarms on valid cleanup, missed consequential defects and cost as separate outcomes.
7. Audit installed consumers before release so old conflicting skills and new rules do not coexist. Verify rollback to the prior pinned release.

No research paper or reference harness substitutes for these acceptance tests.
