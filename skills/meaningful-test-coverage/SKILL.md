---
name: meaningful-test-coverage
description: |
  Author thorough, no-theater tests across every layer a change touches — via a
  multi-agent workflow that designs the RIGHT-level test per layer, adversarially
  verifies each for test theater / over-mocking, then implements and runs the
  survivors. Use after a substantive multi-layer change (data/schema + query +
  service + frontend) when you want coverage that actually catches the bug, not
  green-theater. Enforces the inversion test and level-correctness (data/query →
  integration, pure logic → unit, rendering → component, story → E2E).
---

# Meaningful Test Coverage (no theater)

Coding agents are weakest at *verification* — they reliably write happy-path code
and happy-path tests that pass against their own output. This skill forces tests
that catch the bug: right level, proven to fail on the old code, no theater.

Use it when:
- a change spans multiple layers (data/schema, query/ORM, service, UI, E2E)
- you need confidence the tests genuinely guard the fix (they FAIL on the old code)
- you want to avoid over-mocking and assert-on-mock-return theater

## The four litmus tests (apply to every proposed test)

1. **Right level for what can actually fail.** Put the guard where the bug lives.
   A bug in a DB query, ORM mapping, or migration can only be caught against a real
   backend — a mocked test asserting the same thing is theater. Pure arithmetic →
   unit; rendering/degraded-state → component; full story → E2E.
2. **The inversion test.** A guard is only meaningful if it would FAIL against the
   old/buggy behavior. State, per test, "would this fail if I reverted the fix?" —
   and verify it (revert locally, watch it go red), at least for the load-bearing guard.
3. **No theater.** No assert-on-mock-return (asserting a stub returned what you
   stubbed). No over-mocking the unit under test. No verify-only tests that still
   pass if the behavior is dropped. Assert on real produced values (captured real
   entities, real rendered DOM, real query results).
4. **Honest disclaimers.** A level that *cannot* cover something must say so, not
   pretend. A mocked-collaborator service test does NOT guard a query inversion —
   write that in the test's doc comment so nobody trusts it for the wrong thing.

## Level-correctness (calibrate the infra to your stack — the mapping is universal)

| Level | Catches | Infra (your stack's tools) |
|---|---|---|
| **Integration** | data/query/schema bugs that only fail against a real backend (SQL/ORM queries, migrations, column mappings) | a real datastore (e.g. Testcontainers/ephemeral DB); seed realistic fixtures |
| **Unit** | pure logic: arithmetic, branching, mapping, passthrough | mock collaborators; assert the real computed output on known inputs |
| **Component** | rendering, empty/degraded states, no-fake-data | a component test runner; assert real output for BOTH happy and degraded inputs |
| **E2E** | the assembled story across the running stack | a browser driver; assert visible state, stable selectors — never on HTTP status alone |

The tools are yours; the mapping isn't — put each guard where the failure actually lives.

## How to run it (the workflow)

Author and launch the bundled `workflow.template.js` (an explicit opt-in to
multi-agent orchestration). Pass `args = { context, infra?, layers? }` where
`context` describes the change **and the OLD buggy behavior** (so the inversion
guard can be judged), and `infra` calibrates the levels to your stack.

- **Design** — one agent per changed layer reads the actual changed files + existing
  test conventions and returns the right-level test design + concrete code, plus a
  `catchesInversion` field answering "would this fail on the old code?".
- **Verify** — an adversarial skeptic per design: over-mocked? wrong level? asserts
  on mock returns? for the data layer, would it actually fail on the reverted bug?
  Default to skepticism; `verdict ∈ {solid, needs-revision, theater-reject}`.
- **Synthesize** — merge into a prioritized plan naming WHICH single layer genuinely
  guards the core bug (usually the integration test).

Then **in the main loop** (not in parallel agents): implement the `solid` designs,
apply the skeptic's `needs-revision` fixes, run them sequentially, and
revert-to-verify the inversion guard goes red on the old code.

## Output contract
- One meaningful test per layer that can independently fail, committed.
- An explicit statement of which layer guards the core bug (and proof it bites).
- Honest doc comments on each test about what it does and does NOT cover.
- Any layer flagged `theater-reject` is rewritten or dropped — never shipped to pad
  a coverage number.

## Worked example — calibrating to OpenELIS-Global-2
Pass `infra` as: integration = `BaseWebContextSensitiveTest` (Testcontainers Postgres
+ full Liquibase), run `mvn -Dtest=X -Dsurefire.failIfNoSpecifiedTests=false test`
(JDK 21 + Docker, **one `mvn` at a time** — shared `target/` corrupts under concurrent
builds); service unit = Mockito; frontend component = vitest + `@testing-library/react`
(NOT jest), real `en.json`; E2E = Playwright `npm run pw:test:*` scripts, visible-state
assertions + stable `data-testid`. (This is the `vector-test-coverage` run that produced
the inversion guard catching a positivity bug no mock could see.)
