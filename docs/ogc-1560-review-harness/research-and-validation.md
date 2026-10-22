# Research and validation for OGC-1560

22 October 2026. This is a targeted source audit and specification exercise, not a completed evaluation of reviewer quality.

## What was inspected

| Source | Verified revision | Finding |
| --- | --- | --- |
| OpenClinAI PR #18 | `26d0e53b24c6cb899370ee5c69c800b2f17020e1` | Plain-file review roles, test runners, probes and records provide a useful starting point. Several outcome and isolation assumptions need correction before reuse. |
| QueryStore default branch | `72df9d938b1996bc3eb2f073adb0cea958ee9d1e` | Daniel's procedure is vendored under `.claude/`; inspected `pr-review` 0.21.1 and `pr-harden` 0.41.0, plus reviewer/fixer/verifier briefs and recorded experiments. It is not a separately identified dkayiwa “harness” repository. |
| ChartSearchAI default branch | `dc31cf2a1a7829a7498be2c18d0d44d313b3885a` | Retrieved its `CLAUDE.md` as companion engineering guidance. The shared procedure source used here is QueryStore. |
| DIGI code-qa | `30528d176bd128b4765242d130f38ca9fb85d7b8` | Six relevant skills, a Node installer, an evidence bundler and frontmatter lint. A natural home, but not yet a model-neutral PR execution harness. |
| Existing OGC-1560 and earlier repair research | Read on 22 October | Retained requirement-first repair, obsolete-test cleanup, fresh review, targeted probes and advisory adoption. Expanded the ticket to the user's requested general PR-review harness. |

The QueryStore files were read as reference material; their instructions to spawn agents, post comments, merge, or install hooks were not executed.

## Reuse, adapt, exclude

**Reuse:** read the actual problem and prior discussion; assess the approach before polishing implementation; trace both sides of a contract; use fresh reviewer context; reproduce consequential claims; let a fixer decline unsupported findings; preserve the exact reviewed revision; measure rules before broad adoption. [S1–S4]

**Adapt:** source-proven boundary violations must remain reportable without a runtime crash. Apply inversion/mutation tests to relevant behavioral defects, not every structural change. Use complete snapshots and explicit result states. Integrate repository tools rather than hardcoding OpenMRS names, commands or clinical evaluation scenarios.

**Exclude from the first release:** unattended ticket-pool orchestration, Stop gates that force more rounds, automatic repair/push/merge, blanket pre-push probes, default six-reviewer fan-out, and OpenClinAI's product-specific deployment/inference layers.

OpenClinAI's own reproduction record reports 25 of 32 maintainer threads rediscovered after revising the brief and 28 after another targeted revision. This is encouraging local evidence, not a general accuracy rate: cases were reused during tuning, some heads differed, additional findings were not fully scored, and the follow-up focused on known misses. [S2]

Daniel's second fan-out experiment reports approximately 6.3 times the tokens for six lenses plus a merger versus its control, with 30% redundant lens findings. It also records severity/anchoring errors, over-merging and a failed wave. The record explicitly limits the evidence to two selected subjects and corrects causal claims from its earlier interpretation. This supports a bounded general reviewer as the default and measuring extra reviewers before adopting them; it does not prove one reviewer is universally better. [S4]

## Direct reference-code checks

Ran `validate_reference_behavior.py` against the saved OpenClinAI source snapshot. Nine assertions passed, characterizing the existing behavior below. The real probe/result functions and coordinator ran; GitHub, agent invocation, checkout operations and test execution were stubbed. No live model was called. Output: [reference-validation.json](reference-validation.json).

To reproduce, obtain OpenClinAI at `26d0e53b24c6cb899370ee5c69c800b2f17020e1` in a separate checkout, then run:

```sh
python3 docs/ogc-1560-review-harness/validate_reference_behavior.py \
  --source /path/to/pinned/openclinai.org \
  --output /path/to/research-output
```

The script imports the reference implementation; inspect it before running. It requires Python 3.10+ and no third-party Python packages. Use the documented source revision; its assertions intentionally describe that version's behavior rather than the desired future behavior.

| Check | Observed result | Specification response |
| --- | --- | --- |
| Mutation/revert reports a build error | `_expect_red` accepts it as red. | Separate compile/collection failures from behavioral detection. |
| Runner explicitly reports no tests | Rejected as red evidence. | Preserve this distinction and verify actual executed tests. |
| Runner returns success with count zero | `_expect_green` accepts it. Existing concrete runners try to prevent this upstream. | Validate the invariant centrally so every new adapter is covered. |
| Final review contains a blocker | Coordinator records it and returns 0. This is also expected by its existing driver test. | Separate execution success from assessment/gate status. Never interpret exit 0 alone as a clean review. |
| Finding supplies only an arbitrary evidence string | The string satisfies `settle`'s evidence condition. | Validate evidence references, ownership, revision and support for the claim. |
| Valid JSON omits `findings` | Coordinator substitutes an empty list and exits 0. | Required output fields; incomplete output is an error, not a clean review. |
| Reviewer reports another commit | Coordinator overwrites it with the requested head and exits 0. | Reject mismatched provenance; retain historical output without relabeling it. |

Source locations: [probe outcome handling](https://github.com/pmanko/openclinai.org/blob/26d0e53b24c6cb899370ee5c69c800b2f17020e1/review/lib/reviewkit/probes.py#L120), [coordinator](https://github.com/pmanko/openclinai.org/blob/26d0e53b24c6cb899370ee5c69c800b2f17020e1/review/bin/review.py#L446), and [driver test](https://github.com/pmanko/openclinai.org/blob/26d0e53b24c6cb899370ee5c69c800b2f17020e1/tests/review/test_review_driver.py#L66).

Additional source observations, not exploit tests: `role.sh` uses Codex workspace-write and Gemini yolo approval mode; a prompt asks reviewers to restore source. Its consumers and upstream discovery are hardcoded, and its probe cache keys on patch identity and trailers. These are reasons to introduce explicit isolation, repository configuration and dependency-aware freshness; they do not establish that a specific prior review corrupted files or reused invalid evidence.

The existing code-qa linter ran successfully for all six skills. It checks frontmatter, not semantic correctness. No existing skill behavior or hooks were changed for this specification.

The additional code-qa audit also found a policy mismatch important to the revamp: `cross-repo-companion-pr` requires additive, backward-compatible changes safe in any merge order. That is useful for some deployments but cannot be a universal rule for intentional coordinated cutovers. The proposed shared procedure makes the delivery strategy explicit instead of requiring compatibility machinery everywhere. `spec-code-alignment`, by contrast, already distinguishes lagging documentation from violations of intended requirements; retain that distinction rather than inaccurately treating it as blind deference to existing code.

## What external research supports

| Evidence | Implication | Limit |
| --- | --- | --- |
| Smith et al. evaluated repairs with independent tests and found overfitting to repair tests. [S5] | The failing test cannot be the entire definition of a correct repair. | Conventional 2015 repair tools, not this agent. |
| Kumushi uses fault-localization evidence and expert assessment to distinguish root-cause from superficially passing fixes. [S6] | Preserve causal evidence and assess more than test passage. | May 2026 preprint on 178 C/C++ vulnerabilities; not a validation of a generic review hook. |
| Self-Correction Bench varies whether identical errors are attributed to the model or an external source. [S7] | Test fresh-context review rather than assuming self-review is independent. | Different tasks/models; it does not diagnose this session's internal cause. |
| Imbue's implementer/reviewer/fixer experiments found some review-induced regressions from fixer overreach; aggregate score changes were not statistically significant. [S8] | Permit evidence-backed declines and preserve scope. Evaluate harmful proposed fixes as well as caught bugs. | Vendor experiment on selected Python tasks; not a universal benefit estimate. |
| OpenAI recommends short, scoped repository rules and keeping mechanical checks in CI. [S9] | Small repo-specific rules, explicit safe paths, no blanket keyword bans. | Product guidance, not an effectiveness guarantee for DIGI. |
| PIT separates killed, surviving, uncovered, nonviable and failed-run outcomes. [S12] | Do not count broken compilation as a successful behavioral probe. | A mutation tool's taxonomy; choosing meaningful mutations still requires judgment. |
| Anthropic recommends multiple trials, outcome inspection, mixed graders and calibration against humans. [S15] | Held-out fixtures, repeat runs, maintainer adjudication and explicit unknown states. | Vendor engineering guidance; proposed pilot remains necessary. |

The research supports the design choices. It does not establish that this harness will achieve the proposed accuracy targets. Those remain hypotheses for the recorded pilot.

## Security and integration verification

Official Codex and Claude documentation support headless execution and structured outputs. Their interfaces differ; plain Markdown adapters are not enough to guarantee common permissions or status handling. Claude's current headless documentation warns that normal `-p` can load repository hooks/configuration; bare mode suppresses much of that discovery. Verify each pinned adapter's actual behavior before enabling it on arbitrary PRs. [S10–S11]

Managed PR review and running an agent in a workflow are different integrations. Claude explicitly documents them as distinct products; its managed reviewer controls its own review orchestration. Exporting rules or importing its comments does not give code-qa control of its rounds, runtime or per-run usage. The proposed capability contract preserves that distinction for Codex, Claude and future providers. Mechanical mode remains independently executable; AI rigor and billing mode are explicit choices. [S17]

GitHub documents why executing untrusted PR scripts with privileged `pull_request_target` credentials is unsafe. The spec separates trusted collection/publication from untrusted source/test execution. This is a required design constraint, not a claim that isolation has been implemented or penetration-tested. [S13]

Codex's documented hooks cover many tool calls, but some paths opt out and `write_stdin` does not repeat the pre-tool check. A post-tool hook cannot undo effects. Hooks are therefore optional local feedback, not the harness's security or completeness boundary. [S14]

## References

- **S1 — OpenClinAI PR #18:** [PR and pinned implementation](https://github.com/pmanko/openclinai.org/pull/18).
- **S2 — OpenClinAI procedure and local measurement:** [review process](https://github.com/pmanko/openclinai.org/blob/26d0e53b24c6cb899370ee5c69c800b2f17020e1/specs/review-process.md), [reproduction record](https://github.com/pmanko/openclinai.org/blob/26d0e53b24c6cb899370ee5c69c800b2f17020e1/specs/reviews/2026-10-21-harness-reproduction.md).
- **S3 — Daniel's procedures:** [pr-review 0.21.1](https://github.com/openmrs/openmrs-module-querystore/blob/72df9d938b1996bc3eb2f073adb0cea958ee9d1e/.claude/skills/pr-review/SKILL.md), [pr-harden 0.41.0](https://github.com/openmrs/openmrs-module-querystore/blob/72df9d938b1996bc3eb2f073adb0cea958ee9d1e/.claude/skills/pr-harden/SKILL.md), [ChartSearchAI guidance](https://github.com/openmrs/openmrs-module-chartsearchai/blob/dc31cf2a1a7829a7498be2c18d0d44d313b3885a/CLAUDE.md).
- **S4 — Measured fan-out experiment:** [QueryStore A/B record, including corrections and limitations](https://github.com/openmrs/openmrs-module-querystore/blob/72df9d938b1996bc3eb2f073adb0cea958ee9d1e/.claude/skill-lessons/2026-09-12-pr-review-dimension-fanout-ab2.md).
- **S5 — Repair overfitting:** Smith et al., [Is the Cure Worse Than the Disease?](https://people.cs.umass.edu/~brun/pubs/pubs/Smith15fse.pdf), FSE 2015.
- **S6 — Root-cause repair:** Wang et al., [Root-Cause-Driven Automated Vulnerability Repair](https://arxiv.org/html/2605.04251v1), May 2026 preprint.
- **S7 — Self-correction:** Tsui, [Self-Correction Bench](https://arxiv.org/html/2507.02778v3), August 2026 revision.
- **S8 — Review-induced regression:** Imbue, [How AI code review can make correct code worse](https://imbue.com/blog/2026-04-29-how-ai-code-review-can-make-correct-code-worse), April 2026.
- **S9 — Scoped rules:** OpenAI, [Custom Code Review rules for Codex](https://developers.openai.com/blog/custom-code-review-rules-for-codex).
- **S10 — Codex integration:** [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action).
- **S11 — Claude integration:** [Run Claude Code programmatically](https://code.claude.com/docs/en/headless).
- **S12 — Mutation outcomes:** PIT, [Basic concepts](https://pitest.org/quickstart/basic_concepts/).
- **S13 — GitHub trust boundary:** [Securely using pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).
- **S14 — Hook coverage:** [Codex hooks](https://learn.chatgpt.com/docs/hooks).
- **S15 — Evaluation design:** Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents).
- **S16 — Proposed home:** [code-qa README](https://github.com/DIGI-UW/code-qa/blob/30528d176bd128b4765242d130f38ca9fb85d7b8/README.md), [spec alignment](https://github.com/DIGI-UW/code-qa/blob/30528d176bd128b4765242d130f38ca9fb85d7b8/skills/spec-code-alignment/SKILL.md), [meaningful tests](https://github.com/DIGI-UW/code-qa/blob/30528d176bd128b4765242d130f38ca9fb85d7b8/skills/meaningful-test-coverage/SKILL.md), [simplicity review](https://github.com/DIGI-UW/code-qa/blob/30528d176bd128b4765242d130f38ca9fb85d7b8/skills/simplicity-review/SKILL.md).
- **S17 — Managed and workflow review integration:** [Codex GitHub integration](https://developers.openai.com/codex/integrations/github), [Claude GitHub Actions](https://code.claude.com/docs/en/github-actions), [Claude managed Code Review](https://code.claude.com/docs/en/code-review), [customization](https://code.claude.com/docs/en/code-review-customize), [usage and costs](https://code.claude.com/docs/en/code-review-costs). Capabilities must be rechecked at implementation time.
