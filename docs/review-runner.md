# Local review runner, version 0.1

This first version supports mechanical checks, a single Codex reviewer, and an
isolated OpenELIS environment. It produces local JSON and Markdown reports. It
never repairs code, pushes, comments on a PR or merges.

## Requirements

- Node.js 20+ and Git.
- AI review: an authenticated Codex CLI supporting the flags used by the adapter
  (tested with 0.160.1). Select a model explicitly. Authentication stays on the
  coordinator; it is not copied into OpenELIS.
- OpenELIS: Lima 2+ (tested with 2.2.1), virtualization, internet access and space
  for a 48 GiB sparse worker disk. The worker uses 4 CPUs and 12 GiB memory.
  macOS uses VZ/Rosetta; Linux needs Lima's compatible virtualization prerequisites.
  Linux execution has not yet been validated by this implementation.

No npm dependencies are required. `npm test` runs offline harness acceptance tests;
`npm run lint` validates the installed skill definitions. Neither spends AI credits.

## Plan, then execute

From the code-qa checkout, select committed revisions in an existing repository.
Uncommitted changes are intentionally excluded. Fetch the PR first using existing
Git/GitHub tooling; this release does not infer a PR or stack from the current branch.

```sh
node review/cli.mjs plan \
  --repo /path/to/OpenELIS-Global-2 --base origin/develop --head PR_BRANCH \
  --environment openelis --out /path/to/review-plan.json
node review/cli.mjs run \
  --plan /path/to/review-plan.json --out /path/to/durable-review-runs
```

The plan shows exact base, merge-base and head commits, changed-file inventory,
scope, environment and limits. Run directories have unique IDs and cannot be
overwritten. Keep evidence outside system temporary directories and outside the
repository being reviewed. Git refs are checked before and after execution; using
full commit IDs deliberately reviews that historical snapshot. This local runner
does not claim the snapshot is still the current GitHub PR head.

Mechanical runs check whitespace in the selected diff and, if OpenELIS is selected,
boot it and run the authentication smoke checks. Mechanical never calls a model.
Source-only checks use `--environment none`, the default.

For a model review, add explicit settings to the plan:

```sh
node review/cli.mjs plan \
  --repo /path/to/repository --base BASE --head HEAD \
  --application targeted --question 'Does this change preserve the agreed boundary?' \
  --path src/consumer.js --context src/producer.js \
  --requirements /path/to/accepted-requirements.txt \
  --rigor standard --adapter codex --model MODEL \
  --billing-mode subscription --review-seconds 300 \
  --out /path/to/targeted-plan.json
```

`--path` and `--context` may repeat. Paths are repository-relative. Context currently
accepts individual files; select relevant unchanged callers/consumers explicitly.
`--requirements` is a caller-selected trusted text file, not executable PR policy.
If it is absent, no new requirement is inferred from the existing tests. Source
files, including PR instructions, are review data.

The model receives the captured base/head source and check results. It cannot
interactively explore or run probes in this first version. Codex runs with shell,
web, apps, plugins, hooks, memory, skill discovery and delegation disabled, in a
separate read-only working directory. Ambient user configuration and project
instructions are suppressed. Nonfatal CLI diagnostics are recorded; failed turns,
missing output and unexpected tool events invalidate the result. Managed host
policy remains administrator-controlled; use a dedicated coordinator for untrusted
public-fork review. This release is not a penetration-tested hostile-code service.

One session and its wall-clock limit are enforced. Codex may make internal requests
within that session; this is not a token or currency cap. API/subscription/unknown
billing is recorded, and reported tokens are retained without converting subscription
usage into dollars. Hard monetary/token limits and automatic escalation are
unsupported. Context omissions produce a partial model review, never clean clearance.

## OpenELIS lifecycle

The worker has no host workspace/home mounts, forwarded SSH agent, host Docker
socket or forwarded application ports. macOS VZ supplies its Rosetta platform share
for architecture translation; that is the only shared filesystem observed in the
live test. The worker has its own Docker engine. It fetches the exact
public OpenELIS commit and uses its supported `scripts/dev-stack up --build
--no-scenarios` launcher. The selected revision must contain that interface and its
pinned dependencies must be accessible. No application checkout on the host changes.

The launcher builds the WAR, frontend and analyzer dependency images from source.
It uses an empty disposable database with the repository's test configuration and
self-signed test TLS. Startup waits for actual login readiness. The smoke check
asserts valid test-admin login, rejection of an incorrect password, and the login
page's application root. This is HTTP/authentication evidence, not a browser workflow
or the complete OpenELIS test suite. Existing repository CI remains authoritative
for its own checks.

Logs record build/startup, check assertions, source/submodule commits and image
inventory. The complete VM is removed after success, failure, timeout or cancellation,
so its containers, volumes and orphaned processes cannot affect another run. No
broad Docker prune is used. A forced coordinator kill can leave a VM behind; recover
only that run with:

```sh
node review/cli.mjs cleanup --run /path/to/durable-review-runs/RUN_ID
```

VM startup/build time is bounded separately by `--startup-seconds` (default 3600).
The smoke check, evidence collection and cleanup each have their own bounded timeout.
A unique worker name prevents accidental reuse; an existing worker is never adopted
by a normal run. Review artifacts can contain source and logs, so store them privately
and publish only deliberately selected evidence.

## Outcomes and evidence

`result.json`, `report.md`, `plan.json` and `packet.json` are retained with logs.
Execution and assessment are separate:

- Exit 0 means requested execution completed, including runs with findings.
- Exit 2 means partial/error; exit 3 means cancelled or superseded.
- `no_findings` is possible only for complete requested coverage. A targeted run
  never claims a whole-PR review or mergeability.
- Missing/malformed output, stale model commits, invented source quotations,
  zero tests, startup failure and exhausted time never become clean results.

The shared procedure lives in `skills/review-change/SKILL.md`; focused skills and
the runner use that single source. Evidence validation checks provenance and exact
quotes. It does not independently prove that the model's semantic judgment is right.

## Later releases

Claude and managed-review import/export, automatic GitHub reviews, PR/thread
collection, stack collection, dynamic probes, browser scenarios, Verified/Deep
rigor and held-out quality evaluation are not implemented. The broader
[specification](ogc-1560-review-harness/specification.md) tracks those goals. The
[current validation record](ogc-1560-review-harness/implementation-status.md) separates
executed tests from those future capabilities.

Adapter references: [Codex noninteractive execution](https://learn.chatgpt.com/docs/non-interactive-mode),
[configuration controls](https://learn.chatgpt.com/docs/config-file/config-reference),
and [Lima configuration](https://lima-vm.io/docs/config/). Installed capabilities are
checked through actual runs rather than inferred from documentation alone.
