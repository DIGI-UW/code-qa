# OGC-1560: code-qa revamp for automated and targeted review

**Specification proposal · 22 October 2026 · implementation not started**
[Jira](https://uwdigi.atlassian.net/browse/OGC-1560) · [agreed goals](goals.md) · [research and validation](research-and-validation.md)

## Decision

Revamp code-qa from a collection of separate skills into one review procedure with reusable checks, selectable applications and selectable rigor. Mechanical checks run without a model. When AI review is selected, a provider-independent harness gives a general reviewer the right context, verifies the evidence behind its findings, and reports exactly what it reviewed. Repositories supply their own responsibility boundaries and validation commands. The same review protocol works locally, in automated PR tooling, and with a human reviewer.

Start AI-assisted runs with one fresh reviewer and report-only results. Retain existing CI, branch protection, delivery commands and human merge authority. Adopt the useful parts of OpenClinAI PR #18 and Daniel Kayiwa's QueryStore/ChartSearchAI procedures; do not transplant their complete orchestration or gating systems. [S1–S4]

The central question is **whether the change solves the intended problem in the component that owns it**. Test passage is evidence about behavior; an existing test is not authority to restore a responsibility the approved design removed.

## Goals and limits

The first release must review arbitrary PRs in OpenELIS and related repositories, including changes spanning producer and consumer repositories. It must catch incorrect repairs, obsolete expectations, lost safeguards, and duplicated responsibilities without obstructing legitimate deletion or refactoring. It must distinguish a completed review with no findings from a failed or incomplete attempt.

The initial pilots are OpenELIS, Analyzer Bridge and a distribution repository: different build systems, responsibilities and risk profiles. Analyzer examples are pilot fixtures, not assumptions in the shared implementation.

Out of scope initially: automatic implementation, pushing or merging; production deployment; a ticket-pool daemon; mandatory organization-wide hooks; six-agent review on every PR; full mutation testing of every commit; a general model benchmark service; clinical inference evaluation. Later optional repair integration consumes the same findings and evidence, with a separate authorization and bounded change scope.

## Applications and rigor are separate choices

The application selects the question and scope. Rigor selects how much verification to do. Neither is selected implicitly by the other.

| Application | Input and expected result |
| --- | --- |
| Automatic PR review | PR snapshot; bounded general review, with relevant checks selected by transparent repository rules. One summary per snapshot. |
| Targeted review | A question plus paths, contract, finding, failure log or revision range. Answer that question with evidence and explicit scope limits. |
| Refactor/removal review | Accepted target state and removed responsibilities. Check that code and obsolete tests were removed together and essential behavior remains. |
| Stack/cross-repository review | Explicit repository/revision relationships; assess both changed layers and the combined delivered/proposed contract. |
| Fix verification/re-review | Prior finding and original reviewed commit; determine what survives at the new head, without restarting unrelated review. |

Targeted lenses include correctness, architecture/ownership, simplicity, test quality, security/access control, compatibility/configuration, and documentation. These are sections/checks within a review, not automatically separate agents. A targeted review can expand to a necessary caller/consumer, explaining why; unrelated defects go to a separate follow-up rather than silently enlarging the assignment.

| Proposed rigor | What runs | AI usage |
| --- | --- | --- |
| **Mechanical** | Snapshot and configuration validity, existing formatter/linter/test commands selected by configuration, evidence completeness, source anchors, stale-result checks and explicit dependency rules. | None. Must work without model credentials. CI compute still has a cost. |
| **Standard** | Mechanical checks plus one fresh general review of the selected scope. Existing evidence is read; unsupported claims remain questions. | One bounded reviewer session. |
| **Verified** | Standard plus focused reproduction/contract checks and targeted challenge of consequential findings. | Bounded extra model/tool usage only as declared in the plan; no automatic second reviewer for every issue. |
| **Deep** | Verified plus an explicitly selected broader interaction/scenario pass and, when justified, fresh specialist review. | Opt-in with a higher explicit budget; number of reviewers/rounds capped. |

Names are proposed. A narrow security question can request Deep, while a large PR can first request Mechanical. A completed targeted run is complete **for that question**; it never claims whole-PR clearance. Large diffs that exceed budget are split or reported incomplete, never silently truncated.

`plan` resolves application, check selection, rigor, adapter/model, context sources, permissions and maximum work before execution. It reports which checks are deterministic and which spend AI usage. Repository owners can preauthorize a fixed automatic-review plan, so each PR does not require a new prompt; manual requests can choose another supported plan.

Budgets include time, tool requests, model calls/rounds and tokens where measurable. Record billing mode (API, subscription credits, local inference or external managed review). Quote currency only when pricing/usage supports it; subscription credits cannot be inferred from token counts. Each adapter declares what limits it can enforce. If it cannot enforce a requested hard monetary/token limit, reject that plan or require the caller to explicitly select supported limits—never pretend a shell timeout enforces dollars. Stop before further work at an enforced limit and preserve a partial report. No silent fallback, paid escalation or extra reviewers.

Illustrative interface, not installed commands:

```sh
code-qa plan --pr <url> --application pr --rigor mechanical
code-qa review --pr <url> --application targeted \
  --question "Does this refactor preserve the agreed ownership boundary?" \
  --rigor verified --adapter codex --budget <approved-budget>
code-qa review --plan <approved-plan.json> --adapter claude
code-qa import --adapter <managed-review-provider> --report <export.json>
```

Plan, execution and imported reports use the same run contract. Import never invents evidence that the external provider did not supply.

## Ownership of the harness

| Part | Responsibility |
| --- | --- |
| Shared package | Snapshot collection, adapter interface, schema and evidence checks, bounded execution, result records, report rendering. |
| Repository configuration | Accepted requirements, component ownership, affected-neighbor rules, approved test commands, existing CI checks, confidentiality and publication policy. |
| General reviewer | Explain the change's purpose, trace consequences, propose findings and focused probes. It does not decide new policy. |
| Verification executor | Run selected commands in isolation; record observations and distinguish behavioral failures from environment/build failures. |
| Maintainer | Set policy, settle ambiguous design choices, accept or decline findings, decide merges. |
| Existing CI | Formatting, builds, full suites and established deterministic checks. The reviewer consumes their evidence. |

Use [DIGI-UW/code-qa](https://github.com/DIGI-UW/code-qa) as the proposed home, distributed by pinned release with a thin workflow in each repository. Its current tooling is Node.js ES modules; extend that runtime with ordinary JSON/Markdown contracts rather than introducing Python solely to copy the OpenClinAI coordinator. Python remains useful for reference characterization and repository-specific runners. No new service or framework is needed. [S16]

### Fit with existing code-qa

Current baseline: `30528d176bd128b4765242d130f38ca9fb85d7b8`, verified against upstream `main` on 22 October.

| Existing asset | Reuse and necessary clarification |
| --- | --- |
| `simplicity-review` | Keep requirement-first review, architecture audit and complete removal. Clarify that keeping tests green includes updating/deleting obsolete tests. |
| `spec-code-alignment` | Keep its distinction between stale documentation and code violating an intended requirement. Code establishes what runs, not what ought to run. Do not claim its current procedure blindly treats code as authoritative; it explicitly warns against diluting requirements. |
| `meaningful-test-coverage` | Keep appropriate test levels and meaningful assertions. Limit old-code/red-test requirements to applicable behavioral changes; add the refactoring/removal cases and distinct build-error outcome. Its multi-agent template remains optional. |
| `cross-repo-companion-pr` | Split contract review from delivery actions. Its current universal additive/any-order compatibility rule is unsuitable for approved cutovers: configuration must distinguish independent rollout, ordered migration and atomic version-set deployment. Never invent fallback code merely to satisfy that rule. |
| `evidence-bundle` | Reuse suitable artifact/report conventions. Browser screenshots and videos stay optional; ordinary PR review does not require a visual evidence bundle. |
| `commit-pr-hygiene` | Separate deterministic checks, optional editorial guidance and publication policy. Allow repository-preauthorized automatic summaries while preserving explicit authorization for human-facing messages and merge actions. |
| Installer and lint | Preserve skill installation and add runner/protocol tests. The existing CI validates skill frontmatter; it does not validate review correctness. |

Proposed structure: `review/` for the common protocol, deterministic checks, optional semantic lenses and adapters; `tests/review/` for offline fixtures and protocol tests; `examples/repositories/` for pilot configurations. Agent skills become thin entry points into this procedure. Consolidate ownership/simplicity/spec-alignment rules into one source, with focused entry points referring to it. Retire the runtime-specific `Workflow` template as a required path; preserve any optional multi-reviewer recipe only behind the declared Deep plan. Keep evidence-media packaging separate and reusable. Installation remains explicit and preserves existing hooks. These paths are a proposal, not implemented assets.

Migration must include an inventory of installed skills and policy conflicts, a versioned code-qa release, updated repository pins/installers, and removal of superseded copied procedures. A transition alias may point to the new procedure but may not carry a second implementation. Roll back by pinning the prior release and restoring the prior configuration. Do not install both old and new semantics and leave agents to choose.

## Review inputs

Every run captures an immutable review snapshot before invoking a model:

- Repository identity, PR number, base commit, merge-base, head commit and, when relevant, the integration commit being tested.
- Changed files, a complete changed-file inventory, relevant source and tests, accepted requirements, and repository rules at their trusted revision.
- Existing review conversations, including pagination, original comment commits, unresolved sub-points, and superseded PRs when explicitly linked.
- Existing test results tied to their tested revision. Missing logs, inaccessible tickets and unfinished jobs are marked unavailable.
- Related repositories and exact revisions needed to assess a changed contract. Record the actual delivered dependency version separately from a proposed future stack head.
- Adapter and model identifiers, harness/rule/brief versions, budgets and context omissions.

For stacks, import `gh stack` metadata where available and confirm it against Git ancestry and GitHub bases. Otherwise accept an explicit dependency manifest. Do not guess membership from branch names, author identity or whatever happens to be checked out locally. Review the affected layer and the combined proposed state, reporting both scopes.

Commit identities prevent evidence being attributed to the wrong code. They are review provenance, not a new application-level fingerprint requirement. Do not require developers to author hashes, signatures or approval tokens to perform ordinary repairs.

## Requirement authority and context trust

Load harness policy and executable configuration from a trusted release/base revision. Review PR changes to those files as proposed changes, not as instructions controlling that same run. Disable ambient agent hooks, plugins, memory and automatic instruction discovery in the review workspace unless explicitly supplied by the trusted adapter.

Accepted requirements and documented maintainer decisions establish intended behavior. Existing implementation, tests, PR prose, historical bot comments and product mockups are evidence, not automatic authority. Where approved requirements change in the PR, include the authorization and both old/new expectations. An unauthenticated claim in PR text cannot silently override policy.

A repository rule should state the outcome, owner, applicable paths/contracts, a permitted implementation path, and valid exceptions. It must not ban vague words such as “validation,” “mapping” or “fallback.” Review rules can be removed when obsolete. [S9]

When sources disagree, report the specific conflict and review the unaffected scope. Do not turn every disagreement into an approval request or invent a new safeguard.

## Review procedure

1. **Establish purpose and scope.** State intended behavior, the owning component and what is intentionally removed. Classify the change as defect repair, behavior-preserving refactoring, behavior change, removal, or maintenance. Mixed changes can have different classifications per affected behavior.
2. **Survey the whole change before investigating one failure.** Account for changed responsibilities, callers, producers, consumers, state transitions, tests and deleted paths. Then prioritize the consequential risks. Include relevant unchanged neighbors; this is not a whole-repository audit.
3. **Check the approach.** Could removal, relocation or an existing mechanism solve the problem more directly? When repairing a failed test, decide whether the defect belongs in code, contract, configuration or the test expectation. Explicitly identify obsolete tests. Keep a short diagnosis, not a mandatory essay for every hunk.
4. **Trace contracts.** Compare what the producer emits and what the consumer decides, including missing values, retries, restarts, version changes, limits and partial failure where applicable. Identify each decision's owner. Do not demand every possible edge case from every PR.
5. **Verify candidates.** Reproduce runtime claims where feasible. Source-proven ownership, authorization or dependency violations can be actionable without a runtime reproduction; cite the accepted rule and actual call/data path. Missing evidence makes a claim unconfirmed, not harmless.
6. **Challenge consequential findings.** Attempt to refute the claimed consequence, check whether it already existed, whether it was fixed after the comment's original commit, and whether the proposed remedy would undo the intended cleanup. Use a focused fresh verifier only where judgment is needed; a deterministic evidence check is sufficient for simple cases.
7. **Return a bounded report.** Include evidence-backed findings, unresolved questions, coverage and omissions. Recheck snapshot freshness before publication. A clean result is limited to the recorded scope and is never proof that the PR is mergeable.

A later fixer must be allowed to decline a finding with evidence. “Fix everything the reviewer says” is explicitly prohibited: it can create new defects and scope creep. The repair note records why the change belongs to that component, which tests were removed/updated, and what remaining behavior must be preserved. [S5–S8]

## Provider-independent adapter contract

An adapter receives a versioned review packet and returns a versioned JSON report plus an execution record. The core owns validation, statuses and publication, not the model's prose.

First implement Codex CLI, Claude Code CLI and a human/file adapter. These establish portability across two independent agent runtimes without maintaining a provider for every model. A simple API or local-model adapter can follow using the same protocol. Do not assume every model can execute commands; a text-only adapter reads the packet and can request probes from the executor. Missing capabilities produce explicit coverage limits.

Expose four integration surfaces: (1) a normal CLI for local/CI execution, (2) a reusable GitHub workflow with repository-approved trigger and budget policy, (3) thin Codex/Claude/other-agent skill entry points, and (4) import/export for managed review services. Existing Codex or Claude GitHub review can consume an exported scoped brief where supported; code-qa can ingest their outputs and verify cited evidence. Managed services do not necessarily expose custom prompts, sandbox controls, transcripts, usage limits or structured reports. Label imported findings as external, declare the available evidence/capabilities, and never equate a vendor review with a completed code-qa Verified/Deep run. Native-comment ingestion requires matching commit IDs and deduplication; it does not authorize automatic repair. [S10–S11, S17]

Each adapter declares: source-reading and command-request capabilities; structured-output support; process cancellation; timeout handling; usage reporting; and how ambient configuration is suppressed. Validate each against its actual installed version. Structured output improves parsing, not factual accuracy. No automatic downgrade or provider fallback after rate limiting: record the incomplete run, and make any alternate run explicit. [S10–S11]

Reviewers can write scratch notes only in their isolated output directory. The source snapshot is read-only. Test or mutation work uses a separate disposable checkout. Do not expose the user's normal working tree, host Docker socket, SSH agent, Git credentials, production configuration or broadly writable dependency caches.

## Findings, evidence and outcomes

Each finding contains: stable local ID; claim; consequence; severity; owning component/rule where relevant; repository/commit/file/line anchors; evidence references; verification state; and proposed action. Distinguish `confirmed`, `unconfirmed` and `refuted`. A question can remain a useful question. No automatic new guard, code edit or severity upgrade follows from a model's confidence score.

Evidence records are created by the collector/executor, not vouched for by a model saying “tests passed.” Record command, revision, selected and executed test identifiers, assertions/failures, exit status, environment and log location. Check source anchors against the pinned files. Verify that evidence artifacts exist and belong to that run; separately assess whether they support the claim. A nonempty evidence string is insufficient.

Keep two independent result dimensions:

| Execution status | Meaning |
| --- | --- |
| complete | Requested coverage finished and output/evidence is valid. |
| partial | Useful output exists, but required context or checks are missing. |
| error | Adapter, parser, runner or tool failed. |
| cancelled / superseded | Run stopped or newer code replaced the snapshot. |

The assessment is `findings`, `no_findings` or `undetermined`. Only a complete run can conclude `no_findings`. A complete run with findings is operationally successful but does not mean the patch passed review. Missing fields, malformed output, timeout, rate limit and zero required tests must never become an empty clean review.

The proposed `review run` command returns 0 for complete, 2 for partial/error, and 3 for cancelled/superseded, with assessment always in its JSON. A separate `review gate` command, if later enabled, returns 1 for a configured confirmed violation and never maps an incomplete run to a pass. This avoids conflating successful execution with a clean verdict.

Any changed head, base, relevant dependency or accepted rule makes the result stale for current publication. Preserve the historical report and rerun affected review; do not overwrite the reviewer-reported revision. Rebase-equivalent patches can reuse context preparation, but patch identity alone cannot certify behavior against a new base.

## Validation commands and regression probes

Use existing runners through repository adapters; do not rebuild CI. OpenELIS adapters must respect its Java/toolchain requirements, checkout ownership, supported development/CI launchers and checkpoint semantics. A PR review may request a focused test, while full CI remains independently reported.

For defect repairs or new safeguards, selected executable probes should distinguish corrected and defective behavior. An applicable old-code or mutation run must reach the intended assertion; a compile error, collection error, missing dependency, timeout or zero tests is a separate outcome. “The mutant died” does not prove the test protects the intended requirement. Record the assertion and why it is relevant. [S12]

Behavior-preserving refactoring may legitimately pass the same tests before and after. Approved removal may require deleting tests. Do not demand a contrived red test or a universal revert probe for these cases. Use representative behavior/contract tests and verify the removed responsibility does not remain elsewhere. Mutations are targeted, selected by risk, run in isolation and always restored or discarded on cancellation.

## GitHub operation and local hooks

Default installed policy: Mechanical on eligible PR open/reopen/synchronize/ready events. Repository owners can opt into a preauthorized Standard/Verified plan with a fixed budget, allowed providers and trusted triggers. Skip drafts unless requested. Support targeted dispatch with a question/lens/scope; validate the requester's authority without treating request text as executable configuration. Deduplicate runs by snapshot and configuration; cancel or supersede older runs within a fixed budget. An eligible fork review uses trusted workflow policy and isolated untrusted-code execution.

Separate collection, model review, optional test execution and publication privileges. These can be jobs/processes in one small tool, not new services. PR source and artifacts are untrusted data. Never run a fork's scripts with repository secrets or a privileged GitHub token. Model credentials must remain outside the command-execution sandbox, using a restricted broker/proxy where needed. A model-access key must not double as repository-write access. [S13]

Publish one maintained check summary by default. Inline findings are optional and limited to verified, actionable items with valid anchors. Use an authorized publisher with narrow credentials; the reviewer cannot post, resolve threads, approve, push or merge. Before posting, compare current head/base with the snapshot. A changed head requires a new result, not a relocated old comment. Link existing findings to their threads; do not repost fixed findings. Human-thread resolution remains a maintainer action unless a repository explicitly delegates it.

Local hooks are optional adapters after the core works. A post-test-failure hook may prepare the diagnosis packet and suggest the ownership check before repair. It does not intercept every nonzero command, replace existing hooks, deny authorized cleanup, or prevent the user from ending a session. Host hook coverage is incomplete; server-side CI is the reproducible execution path. [S14]

## Pilot and acceptance

Create a small versioned fixture corpus, not a benchmark platform. Proposed starting set: 36 cases across three repositories, balanced between defects and valid changes; 12 development cases and 24 held-out cases grouped by issue family to limit leakage. Include obsolete-test deletion, clean refactoring, preserved access controls, duplicated interpretation, retry behavior, missing consumers, fabricated evidence, stale commits, prompt injection and broken runners.

Compare the current generic-review baseline with the new packet/procedure under the same model, budget and tool access. Evaluate two adapters with three trials per held-out case. Freeze labels and rules before the held-out run; keep known review comments/fixes out of the replay packet. Have maintainers adjudicate correctness and severity, with explicit disagreement records. This is a proposed experiment, not a completed benchmark. [S15]

Measure actionable precision, recall of consequential defects, false alarms on valid changes, duplicate comments, unsupported claims, incomplete-run rate, cost, latency and maintainer time. Also count harmful proposed fixes: a reviewer that finds more issues but asks to restore removed machinery has failed the objective.

Proposed targets to freeze before the pilot: at least 90% actionable precision and 80% recall of the labeled consequential defects; no valid removal/refactoring fixture incorrectly classified as a merge-blocking violation; every operational failure fixture represented accurately. Report numerators and denominators, per-case repeatability and uncertainty. Small-sample results are grounds for an advisory rollout, not proof of safety or authority for broad semantic blocking.

Then run report-only on 20 real PRs across the pilots. Improve rules using development cases and reviewed real feedback, not repeated tuning to the held-out set. Repeat the held-out evaluation when prompts, models, adapters or rules materially change. Semantic findings stay advisory in the initial release; only established deterministic rules are candidates for later blocking.

## Implementation milestones

| Milestone | Concrete deliverable and exit condition |
| --- | --- |
| M1: revamp and mechanical path | Inventory and consolidate existing skills; define applications/rigor/budget matrix, packet/report schemas, trusted repo config, source snapshots, human adapter, outcome validator and isolated runner. Mechanical works with no model credentials. Missing output, stale code and zero tests cannot become clean results. |
| M2: model adapters and targeted reviews | Codex and Claude adapters; three repository configurations; targeted and general review through the same protocol; evidence verification and report rendering. Demonstrate supported budgets, explicit partial outcomes and no silent provider/escalation changes. |
| M3: automated integration | Trusted GitHub workflow, managed-review import/export, fork isolation, head-refresh check, idempotent summary publishing and stack/dependency support. Demonstrate untrusted config cannot grant tools or credits and stale reports cannot be posted as current. |
| M4: measured adoption | Complete the blinded fixture evaluation and real-PR pilot; publish costs, misses and false alarms; document installation, exception handling, maintenance and rollback. |
| Later, separately justified | Optional local failure hooks, additional model adapters, narrow deterministic gates, optional repair handoff. No autonomous repair loop is required for M1–M4. |

Before implementation, name the code-qa maintainers responsible for the runner, allowed providers and source-data policy, per-run budgets, retention policy and pilot maintainers. These are configuration/ownership decisions, not reasons to postpone the protocol and fixture work.

## Specification validation performed

The reference sources were inspected at recorded commits. Nine deterministic characterization checks exercised OpenClinAI's actual probe/coordinator logic with external operations stubbed. They confirmed the outcome-handling gaps listed in the research record. No live reviewer-quality experiment, fork-isolation penetration test, production deployment, source-code cleanup or hook installation was performed for this specification. The milestone acceptance tests and pilot above are still required.

Source keys S1–S17 resolve to direct links in [research-and-validation.md](research-and-validation.md). [Validation matrix](validation-matrix.md) maps the revamp to the user goals and named reference systems.
