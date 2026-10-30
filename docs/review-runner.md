# Review runner, version 0.4

Run a mechanical or Codex review of an existing GitHub PR, or select local committed
revisions. L1 and L2 are executable. Levels L3–L5 have explicit evidence requirements but their verification executors are not implemented yet; requests return partial before startup or AI spend. L1/L2 can still consume declared checks in disposable OpenELIS. Reports stay local.

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

| Level | Evidence obligation | Current execution |
| --- | --- | --- |
| L1 Mechanical | Selected deterministic checks; zero AI | Available |
| L2 Semantic | Intent, ownership, consumers and test adequacy; explicit questions and coverage | Available as reviewer judgments with source/check evidence |
| L3 Test strength | L2 plus applicable executable test-strength proof | Partial: executor pending |
| L4 Running integration | L3 plus loaded-candidate identity and integration scenarios | Partial: executors pending |
| L5 Product acceptance | L4 plus full-stack workflow/design acceptance | Partial: executors pending |

A check labeled scenario cannot satisfy higher-level requirements. Plan schema 4
and evidence-contract version 3 prevent old saved plans from silently acquiring new semantics.

Execution defaults are separate: the development profile uses one gpt-6.1-sol session,
120 seconds and low reasoning. It is the inexpensive default while the harness is
being developed, not a model ceiling. Use --model MODEL_ID, --review-seconds and
--reasoning-effort to override supported settings. Only the Codex adapter is currently
installed; it passes the selected model to Codex, which determines availability.
An unavailable model fails without fallback. Other adapters remain roadmap work.

The preview and report show required evidence, capability gaps, execution profile
and effective settings. Higher levels do not implicitly select stronger models,
more reasoning or more sessions. There is no source-byte cap. Time limits do not
enforce tokens or dollars; hard token/currency caps and extra sessions remain
unsupported. Reported usage is retained without converting subscription credits
into dollars. L1 is the default; legacy rigor aliases select L1/L3, with L3 now
reporting its missing evidence capabilities.

A source-only L2 review does not claim runtime acceptance. Missing necessary context,
unassessed areas or unanswered verification questions yield partial/undetermined.
The area rationales are model judgments, not independently validated factual proof.
Large files are not rejected before review.

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
Version 0.1–0.3 plans must be recreated (plan schema 4, evidence-contract version 3); their owned workers can still be cleaned up. Old packet-only plans are not silently upgraded.

## Context and trusted repository configuration

The reviewer starts with the selected diff and can search/read any committed file
in the exact head or merge-base snapshot, including unchanged callers and tests.
`--context` and trusted context rules are optional starting hints, not an access
allowlist. The old automatic import/filename expansion and `--no-auto-context`
option are removed; context selection now happens during review. Targeted findings
must still concern the selected question/change. Submodule Gitlinks remain visible,
but submodule repositories are not automatically fetched.

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
Configuration may additionally supply `environment`, a `checks` array, and AI `profile`, `adapter` and `model` settings. Explicit CLI options take precedence. Never
use configuration from an unreviewed PR as a trusted operator override.

## Executable checks and scenarios

```sh
code-qa review --pr https://github.com/DIGI-UW/OpenELIS-Global-2/pull/NUMBER \
  --level L2 --environment openelis --checks examples/openelis-checks.json \
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

Codex receives scope and check evidence in a separate directory with a fresh bare
Git repository containing the pinned base/head snapshots. It uses `git diff`,
`git grep` and `git show` through a read-only shell; the source is not checked out.
This avoids loading PR-owned agent instructions, configuration or symlinks as
filesystem configuration. Local uncommitted/untracked files, repository configuration,
hooks and remotes are not copied. The snapshot and command transcript are retained.

The adapter ignores user configuration and rules, disables automatic project
instructions, host skills, hooks, memory, apps and delegation, and uses no approvals.
Shell commands receive a minimal environment. The reviewer is instructed to inspect
only the snapshot, never run repository code/tests, read host credentials, repair,
publish or merge. Read-only mode prevents filesystem mutations and disables command
network access; it is **not a confidentiality boundary for all host reads**. Use a
dedicated coordinator for hostile public-fork review. This is not a penetration-tested
multi-tenant service. Authentication stays on the coordinator, not in the OpenELIS
worker or snapshot. Artifacts may contain source and logs; retain them privately and
publish only deliberately selected evidence.

## Reports and exit codes

Each run retains `plan.json`, `packet.json`, `result.json`, `report.md` and logs.
The report shows scope, level, model/limits, executed assertions, evidence-linked
findings, dispositions, counterevidence, area assessments, unanswered questions, omissions and cleanup. Source quotes, including those from unchanged files discovered during review, are
checked against exact committed lines and retained in `packet.json`. Unread source
is not represented as reviewed merely because it was available. GitHub check status is a collection-time snapshot, not a replacement for
live CI.

- Exit 0: requested execution completed, including completed runs **with findings**.
- Exit 2: partial or error. Exit 3: cancelled or superseded.
- `no_findings` means no actionable findings within complete requested coverage. Suggestions and refuted candidates remain visible, but do not count as actionable defects. Missing assessments or unanswered questions prevent a complete result.
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
quality evaluation remain later milestones. Local PR collection, freshness, L1/L2 execution and higher-level capability-gap reporting are implemented. See the [checklist](ogc-1560-review-harness/roadmap.md) for unfinished Stage 1 work as well as later stages.

Adapter references: [Codex developer commands](https://learn.chatgpt.com/docs/developer-commands),
[configuration](https://learn.chatgpt.com/docs/config-file/config-reference),
and [Lima configuration](https://lima-vm.io/docs/config/).
