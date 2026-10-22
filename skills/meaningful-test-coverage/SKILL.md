---
name: meaningful-test-coverage
description: Design and assess tests at the level where the changed behavior can fail. Use when verifying a substantive change, refactor or removal; distinguish meaningful assertion failures from build failures and obsolete test expectations.
---

# Meaningful test coverage

Use the [shared review procedure](../review-change/SKILL.md). Identify intended behavior and removed responsibilities before deciding which tests to retain, change or delete.

Choose the narrowest test that exercises the actual failure:

| Behavior | Useful evidence |
| --- | --- |
| Query, ORM or migration | Real datastore/framework integration, including relevant existing data |
| Pure calculation or branching | Unit tests of produced values; mock collaborators, not the decision under test |
| Rendered and degraded UI state | Component tests with real rendering and meaningful assertions |
| Assembled user workflow | Browser tests against the running application, asserting visible state |

For a defect repair, a targeted old-code or mutation probe can show that the relevant assertion detects the defect. Build failure, collection failure, timeout and zero executed tests do not establish that. Do not force this technique onto behavior-preserving refactoring or approved removal: unchanged behavioral tests can legitimately pass, and obsolete tests can be deleted.

Review proposed tests for assertions on mock return values, unnecessary layers, and cases that still pass when required behavior disappears. Use the project's supported runner and report selected/executed tests and limitations. Independent reviewers and mutation testing are optional, budgeted techniques; this procedure requires neither a multi-agent runtime nor a test per layer.

Return the behavior covered, observed result, any obsolete tests removed, and what remains unverified. Do not expand implementation merely to satisfy the previous test suite.
