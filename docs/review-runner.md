# Review runner, version 0.5

Run selected L1–L5 reviews against pinned GitHub PRs or local committed revisions. Each level requires its actual evidence. Reports remain local unless the operator explicitly invokes publication. The [execution guide](ogc-1560-review-harness/execution-guide.md) specifies decisions, history, attached repositories, checks/probes, runtime evidence, workflows/designs and managed-result exchange.

## Install and start

Requirements: Node.js 20+, Git, and authenticated `gh` for PR URLs. AI levels also
need an authenticated Codex CLI (validated with 0.165.0) or Claude CLI. OpenELIS execution needs
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
| L3 Test strength | L2 plus applicable executable test-strength proof | Applicable production mutation/revert against fixed tests |
| L4 Running integration | L3 plus loaded-candidate identity and integration scenarios | Loaded-artifact and selected integration evidence |
| L5 Product acceptance | L4 plus full-stack workflow/design acceptance | Rendered comparison and saved-state acceptance matrix |

A check labeled scenario cannot satisfy higher-level requirements. Plan schema 4
and evidence-contract version 3 prevent old saved plans from silently acquiring new semantics.

Execution defaults are separate: the development profile uses one gpt-6.1-sol session,
120 seconds and low reasoning. It is the inexpensive default while the harness is
being developed, not a model ceiling. Use --model MODEL_ID, --review-seconds and
--reasoning-effort to override supported settings. Codex and Claude adapters pass the explicitly selected model to their CLI. Claude requires --adapter claude --model MODEL_ID. An unavailable model fails without fallback. Claude L5 remains unavailable pending image conformance.

The preview and report show required evidence, capability gaps, execution profile
and effective settings. Higher levels do not implicitly select stronger models,
more reasoning or more sessions. There is no source-byte cap. Time limits do not
enforce tokens or dollars; hard token/currency caps remain unsupported. --max-rounds 0..2 explicitly reserves additional reconsideration sessions within the same total time allowance. Reported usage is retained without converting subscription credits
into dollars. L1 is the default; legacy rigor aliases select L1/L3, with the same evidence requirements as an explicit level.

A source-only L2 review does not claim runtime acceptance. Missing necessary context,
unassessed areas or unanswered verification questions yield partial/undetermined.
Reports put work outside the selected level in `scopeNotes`, rendered as “Outside this review.” Reading tests at L2 does not claim their execution; an unselected runtime test is not itself a source-coverage omission. Missing necessary source or an unanswered in-scope question remains partial. Explicit partial reports are never silently upgraded.
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
`kind` is `test`, `scenario` or `command`; scenario means an explicitly selected interaction
check. `argv` runs directly, without implicit shell expansion. Optional `cwd` and
report patterns are relative to the isolated source root. Checks receive the
launcher’s exported environment, including test endpoint URLs. At most 20 checks
may run; each has a 1–3600 second limit. Select fresh JUnit XML reports from that
command; stale matching reports are removed before execution. At least one
non-skipped testcase is required. Malformed, missing, zero-test, timeout and
command-failure output cannot become behavioral proof. Test failures retain their
assertions as findings. Predeclared experiments may also be requested by the reviewer within an explicitly reserved round allowance. Only catalog IDs execute; the model cannot supply commands.

## Isolation and lifecycle

The OpenELIS worker has its own Docker engine and synthetic database, no host
workspace/home mount, forwarded SSH agent, host Docker socket or application port
forwarding. macOS supplies only its Rosetta translation share. The worker fetches
the exact public `DIGI-UW/OpenELIS-Global-2` commit and its recorded dependencies;
local OpenELIS plans must use a commit available there. It invokes the repository’s
`scripts/dev-stack up --build --no-scenarios`. The chosen revision must support
that interface. Application startup remains owned by OpenELIS, not duplicated in
code-qa. Other repositories can use the generic isolated container executor or source-only review; see the execution guide.

Startup builds from source and waits for login readiness. Authentication smoke
checks valid test-admin login, rejection of an incorrect password, and the frontend
application root. Declared checks then run, evidence is collected and the whole
VM is removed after review and any authorized requested experiments. Startup defaults to 3600 seconds,
overridden with `--startup-seconds`; each test, evidence collection and cleanup
has its own timeout. Failure/cancellation also triggers scoped cleanup. A forced
coordinator kill may leave a worker; recover only that run with:

```sh
code-qa cleanup --run /path/to/review-runs/RUN_ID
```

Codex and Claude receive pinned source through a read-only operation broker, with built-in shell/file/network/write tools disabled. Bare Git data never activates repository instructions, configuration or symlinks. Supplied artifacts are readable by ID; other host files and credentials are not exposed through tools. The trusted provider executable retains authentication. This is a capability boundary, not an OS sandbox for arbitrary provider software. See the [automation boundary](ogc-1560-review-harness/automation-boundary.md) for validated controls and remaining deployment acceptance.

## Reports and exit codes

Each run retains `plan.json`, `packet.json`, `result.json`, `report.md` and logs.
Source preparation checks for missing Git objects without fetching from a promisor remote. If objects are missing, explicitly materialize the pinned trees in the source checkout and create a new run. Preparation failures retain their stage and sanitized Git diagnostic in `reviewer/repository-error.txt` (or the attached source subdirectory); no AI review starts for an unavailable snapshot.
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
The implemented CLI includes Codex/Claude adapters, external-result import, explicit verified-finding publication, conversation/history and pinned dependency collection, probes and paired evaluation. See the [checklist](ogc-1560-review-harness/roadmap.md) for acceptance evidence and remaining independent labels/adjudication, and deployment configuration. The manual hosted CI profile supports source-only L1/L2; richer levels use isolated local execution.

Adapter references: [Codex developer commands](https://learn.chatgpt.com/docs/developer-commands),
[configuration](https://learn.chatgpt.com/docs/config-file/config-reference),
and [Lima configuration](https://lima-vm.io/docs/config/).

## Native gh stacks

Use `plan/review --stack --repo CHECKOUT` for first-class stack collection, layer and combined diff inspection, explicit coverage, and owning-PR findings. `--stack-layer NUMBER` selects an intermediate candidate; `--previous-stack PLAN` adds the previous ranges and parent comparisons. See [the native stack guide](stack-review.md). The hosted workflow remains single-PR.
