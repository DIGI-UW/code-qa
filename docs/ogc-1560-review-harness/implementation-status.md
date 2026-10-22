# First version implementation and validation

22 October 2026. Scope: local mechanical checks, one Codex reviewer and a disposable OpenELIS environment. No merging, automatic publication, second model adapter or live-PR quality pilot.

## Implemented

- Local plan/run/report commands, immutable source packets, targeted/general scope and explicit limits.
- Mechanical execution without AI credentials; structured output and evidence validation; separate execution and assessment states.
- OpenELIS adapter using a Lima worker and the repository's existing source launcher; authentication smoke checks, evidence capture, scoped teardown and recovery command.
- One packet-only Codex session with explicit model/billing mode, no repair/tools, bounded time and recorded usage.
- Shared review procedure used by the runner and focused skills. Removed mandatory inversion/multi-agent workflow and universal additive rollout policy.

## Executed validation so far

- 25 offline acceptance tests passed, including malformed/stale output, missing evidence, scope omission, failed startup, zero tests, cancellation, cleanup failure, subprocess-group termination and installation links.
- Seven skill definitions passed the repository linter; the shared skill passed Skill Creator validation; Lima validated the worker configuration.
- Real Codex smokes: a seeded double-conversion defect was identified with matching source quotations; an approved deletion of an unused parser and its obsolete tests completed with no findings. These two cases are integration evidence, not an accuracy benchmark.
- Real cancellation: a second VM reached readiness, was cancelled and removed, while the primary OpenELIS worker remained running. A later cancellation during a source build exposed an escaped SSH process holding output pipes open; the scoped recovery command removed that worker. Cancellation now closes retained streams after its termination grace period, with a regression test using a real detached descendant.
- OpenELIS PR #4798 at 556f35d6708f28ec32659a9f25a5ab5e80c268a4 built from source in a fresh VM and reached login readiness. Valid login and frontend document assertions passed. The negative-login probe expected the wrong response shape; it is now aligned with the source contract (401 plus `error.invalidcredentials`) and covered by a real-HTTP regression test. A new full run will verify the correction. Both earlier workers were removed, including an initial startup failure caused by Docker group activation.

- Live isolation inspection found that Lima requires `guestIPMustBeZero: false` to apply its forwarding exclusion to loopback listeners as well as wildcard binds. The rule is corrected; a fresh worker will verify both bind types. The worker has no user filesystem mounts; macOS supplies a Rosetta platform share.

## Remaining before delivery

- Finish the live OpenELIS build, readiness, smoke assertions and cleanup; inspect retained evidence.
- The implementation is pushed as draft PR #2; its first CI run passed. Record final live results and recheck CI after the probe correction.

Broader model reliability, hostile-code penetration testing, Linux-host virtualization and complete OpenELIS/browser suites are not established by these checks. See the [runner guide](../review-runner.md) for supported scope and limits.
