# OGC-1560 — agreed goals and constraints

Captured 22 October 2026 from the user's requests in this conversation. This file records the requested outcome; implementation choices and numerical pilot targets in the specification remain proposals.

1. **Revamp DIGI code-qa.** Rethink its purpose, structure and application. Do not merely add another runner beside overlapping skills. Inventory what to retain, rewrite, combine and retire.
2. **Serve OpenELIS and related repositories generally.** Build a flexible review harness for general-purpose language-model reviewers, without analyzer-specific assumptions in its core.
3. **Support automatic PR reviews.** Make the procedure available to automated tooling reviewing incoming PRs, with explicit triggers, permissions, results and failure states.
4. **Support targeted reviews.** A person or tool can request a particular question, area, risk, contract, test failure, change or repository relationship. Report what was reviewed and do not present a narrow review as a full-PR clearance.
5. **Offer different levels and applications.** Separate review purpose from review rigor. A focused architecture review and a broad PR review must each be able to select appropriate effort.
6. **Run mechanical checks without AI credits.** Deterministic checks are independently usable from a terminal, hook or CI and do not require a model account or silently invoke a model.
7. **Make paid AI review an explicit choice.** Select the rigor, model/provider and maximum budget. Show the planned work and likely cost basis before execution; record actual usage where available, and never imply an unknown cost is zero. No silent provider fallback, extra reviewers or escalation of rigor.
8. **Integrate with Codex, Claude and other automated review tooling.** Define a common packet/result contract and capability-aware adapters. Support invoking reviewers and consuming external reviewer output; do not depend on one application's subagent, hook or session API. Preserve a human/manual path.
9. **Ground the design in the supplied targets.** Inspect OpenClinAI PR #18 and its review work; Daniel Kayiwa's procedures used in QueryStore, ChartSearchAI and other repositories; current DIGI code-qa; and the earlier repair-failure research.
10. **Do additional research and validation.** Check primary sources, inspect actual implementations and reproduce useful claims. Validate the proposed design against those references and concrete OpenELIS-family cases. Distinguish source inspection, deterministic checks, manual assessment and live model evaluation.
11. **Prevent symptom repair from recreating removed responsibilities.** Accepted requirements and ownership determine whether implementation, configuration, contract or test expectation is wrong. Explicitly allow deletion/relocation of obsolete code and tests; do not restore rejected machinery solely to make a test pass.
12. **Make evidence and limitations explicit.** Findings need traceable support. Missing output, unavailable context, build errors, zero tests, stale commits and model failure must not masquerade as a clean review. Review status, CI health and mergeability are separate.
13. **Keep adoption proportionate.** Reuse existing repository CI, launchers and delivery tooling. Start semantic review in advisory mode, measure false alarms and missed defects, and avoid mandatory agent loops or new approval gates for already authorized engineering work.
14. **Persist the work.** Keep these goals, a researched specification, validation results and phased acceptance criteria in code-qa and link them from OGC-1560.

15. **Build the first version before piloting it.** Deliver and test a locally runnable harness, including one AI adapter and one working repository environment, before expanding integrations and evaluating it on real PRs. Controlled fixture tests are implementation work, not the pilot.
16. **Boot an isolated environment of the PR when verification needs it.** Include required application services, pinned dependencies, synthetic fixtures, readiness checks, evidence capture and scoped cleanup. Source-only checks can skip startup. Reuse repository launchers without touching active developer or shared deployments.

## Current scope

The user has authorized implementing, testing and pushing the first version: OpenELIS is the first isolated environment and one AI reviewer is included. Broader automation, additional adapters and the quality pilot remain later work. Do not change application behavior, install enforcement hooks, merge PRs or claim model-review reliability from a small smoke test.

## Decisions still open

The exact rigor-level names/defaults, allowed providers and models, budget amounts, source-data policy, maintainer ownership, artifact retention and pilot thresholds are design proposals to settle. No choice of those details should silently remove any goal above.
