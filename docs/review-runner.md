# Review runner, version 0.2

Run a mechanical or Codex review of an existing GitHub PR, or select local committed
revisions. L4/L5 execute declared tests and scenarios in disposable OpenELIS before
one reviewer examines the source and execution evidence. Reports stay local.

## Install and start

Requirements: Node.js 20+, Git, and authenticated `gh` for PR URLs. AI levels also
need an authenticated Codex CLI (validated with 0.165.0). OpenELIS execution needs
Python 3, Lima 2+ (validated with 2.2.1), virtualization, internet, and room for a
48 GiB sparse worker disk. Each worker uses 4 CPUs and 12 GiB memory. macOS VZ is
supported; Linux-host execution has not been validated. There are no npm dependencies.

From this code-qa checkout:

```sh
npm install --global .
code-qa levels
code-qa review --pr https://github.com/DIGI-UW/OpenELIS-Global-2/pull/4798 --level L1
```

Installation is optional: replace `code-qa` with `node review/cli.mjs` from the checkout.
The default output directory is `$HOME/code-qa-runs`; `--out` selects another durable
directory. A PR command fetches exact base/head commits into a bare cache without
checking out, resetting, or changing an application worktree. `--repo PATH` can
reuse an existing repository. PR identity is checked before and after execution;
a changed base/head or closed PR makes the result superseded.

A focused, inexpensive review:

```sh
code-qa review --pr https://github.com/OWNER/REPO/pull/NUMBER \
  --level L2 --application targeted --lens ownership \
  --question 'Does this change preserve the agreed producer/consumer boundary?' \
  --path src/consumer.js --context src/producer.js \
  --requirements /path/to/accepted-requirements.txt \
  --billing-mode subscription
```

`--path` selects changed files or directory prefixes. `--context` adds individual
unchanged files. Both may repeat. Choose paths that actually exist in the target
PR. The application (`pr` or `targeted`), question and optional lens are independent
of the level. Supplying a question defaults to targeted application.

## Levels and cost controls

| Level | Executed work | Reviewer seconds | Source bytes | Reasoning |
| --- | --- | ---: | ---: | --- |
| L1 Mechanical | Snapshot, diff whitespace, optional declared execution; no AI | 0 | 32,000 | n/a |
| L2 Lightweight | Focused source review | 120 | 32,000 | low |
| L3 Standard | Broader source review with neighboring context | 300 | 200,000 | medium |
| L4 Verified | Source review plus at least one declared executable check | 600 | 300,000 | high |
| L5 Deep | L4 plus at least one declared interaction/scenario check | 900 | 500,000 | high |

Every AI level permits **one session**, with no automatic retry, additional reviewer
or model upgrade. Defaults use `gpt-6.1-sol`; the explicit allowlist also permits
`gpt-6-sol` and `gpt-6-luna`. Astra and unknown model IDs are rejected. Model IDs are
policy, not a guarantee that an account has access. An unavailable model fails the
run without fallback.

Override `--review-seconds`, `--max-context-bytes`, and `--reasoning-effort` explicitly.
The preview, plan and report record effective settings and preset version. Limits
bound source bytes and reviewer wall time, **not** total prompt tokens or currency.
Requirements, metadata and test evidence add to the prompt. Reported token usage
is retained; subscription credits are not converted into dollars. Hard token/currency
caps and extra sessions are unsupported. Legacy `--rigor mechanical|standard`
aliases resolve to L1/L3 and conflicting level selections fail.

L1 is the default. L4/L5 require `--environment openelis` and declared checks;
login smoke alone cannot satisfy them. Source-only reviews never claim runtime
verification. Completion means completion of the selected scope, not whole-PR
clearance. Missing required source stops AI execution as partial before credits
or VM startup; narrow the question/scope or explicitly raise the allowance.

## Preview or review local revisions

```sh
code-qa plan --pr https://github.com/OWNER/REPO/pull/NUMBER \
  --level L2 --path src/consumer.js --out /path/to/plan.json
code-qa run --plan /path/to/plan.json --out /path/to/review-runs

code-qa review --repo /path/to/repository --base origin/develop --head FEATURE \
  --level L1 --out /path/to/review-runs
```

Plans and run directories are created once and never overwritten. Uncommitted
changes are excluded. Local named refs are checked for movement; explicit SHAs
intentionally select historical evidence and do not claim current GitHub freshness.
Version 0.1 plans must be recreated; their owned workers can still be cleaned up.

## Context and trusted repository configuration

The collector adds direct Java/relative JavaScript/TypeScript imports, matching
tests and one-hop filename references. This is a heuristic, not a complete call
graph. Above 60 changed files it records that discovery was skipped. Use explicit
context or narrow to a coherent scope. `--no-auto-context` disables the heuristic;
it does not discard explicit context or trusted context rules.

`.code-qa.json` is read from the PR **base**, never the proposed head. An explicit
`--config FILE` replaces it. Only these operator/base settings may select commands;
PR descriptions and changed files are untrusted review data. Example:

```json
{
  "requirementsFiles": ["specs/analyzers/spec.md"],
  "contextRules": [
    {
      "paths": ["src/main/java/org/openelisglobal/analyzerimport"],
      "context": ["src/test/java/org/openelisglobal/analyzerimport/service/AnalyzerNormalizedResultContractTest.java"]
    }
  ]
}
```

Requirements files also come from the base. Explicit `--requirements FILE` appends
operator-supplied accepted requirements. Existing tests alone do not establish
required behavior; obsolete tests may legitimately be removed during refactoring.
Configuration may additionally supply `environment` and a `checks` array. Never
use configuration from an unreviewed PR as a trusted operator override.

## Executable checks and scenarios

```sh
code-qa review --pr https://github.com/DIGI-UW/OpenELIS-Global-2/pull/NUMBER \
  --level L5 --environment openelis --checks examples/openelis-checks.json \
  --path src/main/java/org/openelisglobal/analyzerimport/service/AnalyzerNormalizedResultContract.java \
  --context src/test/java/org/openelisglobal/analyzerimport/service/AnalyzerNormalizedResultContractTest.java \
  --question 'Does the result contract preserve canonical numeric values?' \
  --billing-mode subscription
```

The example checks file runs a selected existing contract test and a synthetic FHIR
create/read/update/delete scenario. Adapt selections to the actual PR; it is not a
complete analyzer or AMR acceptance suite. A check has this shape:

```json
{
  "id": "result-contract",
  "kind": "test",
  "argv": ["mvn", "-q", "-Dtest=AnalyzerNormalizedResultContractTest", "test"],
  "reports": ["target/surefire-reports/TEST-*.xml"],
  "timeoutSeconds": 900
}
```

`--checks FILE` contains an array of checks and overrides base-config checks.
`kind` is `test` or `scenario`; scenario means an explicitly selected interaction
check. `argv` runs directly, without implicit shell expansion. Optional `cwd` and
report patterns are relative to the isolated source root. Checks receive the
launcher’s exported environment, including test endpoint URLs. At most 20 checks
may run; each has a 1–3600 second limit. Select fresh JUnit XML reports from that
command; stale matching reports are removed before execution. At least one
non-skipped testcase is required. Malformed, missing, zero-test, timeout and
command-failure output cannot become behavioral proof. Test failures retain their
assertions as findings. These are declared checks run before review, not probes
dynamically requested by the model.

## Isolation and lifecycle

The OpenELIS worker has its own Docker engine and synthetic database, no host
workspace/home mount, forwarded SSH agent, host Docker socket or application port
forwarding. macOS supplies only its Rosetta translation share. The worker fetches
the exact public `DIGI-UW/OpenELIS-Global-2` commit and its recorded dependencies;
local OpenELIS plans must use a commit available there. It invokes the repository’s
`scripts/dev-stack up --build --no-scenarios`. The chosen revision must support
that interface. Application startup remains owned by OpenELIS, not duplicated in
code-qa. Other repositories can use source-only review; other environments are
not implemented.

Startup builds from source and waits for login readiness. Authentication smoke
checks valid test-admin login, rejection of an incorrect password, and the frontend
application root. Declared checks then run, evidence is collected and the whole
VM is removed before the reviewer starts. Startup defaults to 3600 seconds,
overridden with `--startup-seconds`; each test, evidence collection and cleanup
has its own timeout. Failure/cancellation also triggers scoped cleanup. A forced
coordinator kill may leave a worker; recover only that run with:

```sh
code-qa cleanup --run /path/to/review-runs/RUN_ID
```

Codex receives source and check evidence in a separate read-only directory, with
tools, host configuration, hooks, skills, memory and delegation disabled. It cannot
repair, publish or merge. Managed host policy remains administrator-controlled;
use a dedicated coordinator for hostile public-fork review. This is not a
penetration-tested multi-tenant service. Authentication remains on the coordinator
and is not copied into OpenELIS. Artifacts may contain source and logs; retain them
privately and publish only deliberately selected evidence.

## Reports and exit codes

Each run retains `plan.json`, `packet.json`, `result.json`, `report.md` and logs.
The report shows scope, level, model/limits, executed assertions, evidence-linked
findings, omissions and cleanup. Source quotes are checked against exact recorded
lines. GitHub check status is a collection-time snapshot, not a replacement for
live CI.

- Exit 0: requested execution completed, including completed runs **with findings**.
- Exit 2: partial or error. Exit 3: cancelled or superseded.
- `no_findings` is allowed only for complete requested coverage.
- Invalid model output, fabricated quotations, missing tests and unavailable
  services remain unverified. Structural evidence validation does not prove the
  model's judgment correct.

Automation should inspect both `status` and `assessment` in `result.json`; exit 0
alone is not an approval. Reports never establish full CI health or mergeability.

## Validation and remaining integrations

Run `npm test` and `npm run lint` without AI credentials. The
[implementation record](ogc-1560-review-harness/implementation-status.md) distinguishes
automated harness tests, real source reviews and isolated OpenELIS execution.
Claude/other adapters, managed-review import/export, automatic GitHub publication,
review-thread and stack/dependency collection, dynamic probes and the held-out
quality evaluation remain later milestones. Local PR collection, freshness and
L1–L5 execution are implemented in this version.

Adapter references: [Codex developer commands](https://learn.chatgpt.com/docs/developer-commands),
[configuration](https://learn.chatgpt.com/docs/config-file/config-reference),
and [Lima configuration](https://lima-vm.io/docs/config/).
