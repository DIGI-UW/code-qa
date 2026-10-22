# First version implementation and validation

22 October 2026. Scope: local mechanical checks, one Codex reviewer and a disposable OpenELIS environment. No merging, automatic publication, second model adapter or live-PR quality pilot.

## Implemented

- Local plan/run/report commands, immutable source packets, targeted/general scope and explicit limits.
- Mechanical execution without AI credentials; structured output and evidence validation; separate execution and assessment states.
- OpenELIS adapter using a Lima worker and the repository's existing source launcher; authentication smoke checks, evidence capture, scoped teardown and recovery command.
- One packet-only Codex session with explicit model/billing mode, no repair/tools, bounded time and recorded usage.
- Shared review procedure used by the runner and focused skills. Removed mandatory inversion/multi-agent workflow and universal additive rollout policy.

## Executed validation so far

- 23 offline acceptance tests passed, including malformed/stale output, missing evidence, scope omission, failed startup, zero tests, cancellation, cleanup failure, subprocess-group termination and installation links.
- Seven skill definitions passed the repository linter; the shared skill passed Skill Creator validation; Lima validated the worker configuration.
- Real Codex smokes: a seeded double-conversion defect was identified with matching source quotations; an approved deletion of an unused parser and its obsolete tests completed with no findings. These two cases are integration evidence, not an accuracy benchmark.
- Real cancellation: a second VM reached readiness, was cancelled and removed, while the primary OpenELIS worker remained running.
- First OpenELIS startup correctly failed on Docker group permissions, retained logs and removed its VM. Group activation was corrected and a new run is building OpenELIS PR #4798 at 556f35d6708f28ec32659a9f25a5ab5e80c268a4.

## Remaining before delivery

- Finish the live OpenELIS build, readiness, smoke assertions and cleanup; inspect retained evidence.
- Push the implementation stack, inspect CI and record final results.

Broader model reliability, hostile-code penetration testing, Linux-host virtualization and complete OpenELIS/browser suites are not established by these checks. See the [runner guide](../review-runner.md) for supported scope and limits.
