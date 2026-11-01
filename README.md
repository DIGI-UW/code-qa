# code-qa

A shared review procedure and local runner for mechanical checks, one Codex
reviewer, and isolated OpenELIS execution. It records the reviewed revisions,
findings, supporting evidence, usage and incomplete outcomes.

The procedure starts with accepted requirements and component ownership. It
supports legitimate removal of obsolete code and tests. Reviews remain advisory;
recorded evidence does not guarantee that a change is correct.

## Skills

| Skill | What it does |
|---|---|
| **review-change** | Shared requirement, ownership and evidence procedure for general and targeted reviews. |
| **evidence-bundle** | Turn a Playwright/E2E run into a structured, shareable proof — screenshots + MP4 + a narrated report — and draft the PR/Slack surfaces. Deterministic bundler script + LLM narrative. |
| **meaningful-test-coverage** | Assess meaningful tests at the right level, including legitimate refactoring and obsolete-test removal. |
| **simplicity-review** | Review a change for over-engineering — speculative generality, gold-plating, dead code, needless indirection — and propose the simplest version that still meets the spec. The mirror of meaningful-test-coverage. |
| **spec-code-alignment** | Verify spec/design artifacts match the shipped code, catalog drift, remediate the lagging side — distinguishing observed behavior from accepted requirements. |
| **cross-repo-companion-pr** | Review cross-repository contracts and explicit independent, ordered or atomic delivery. |
| **commit-pr-hygiene** | Formatting, comments, commit scope and authorized publication policy. |

Each skill is a directory under `skills/<name>/` with a `SKILL.md` (the agent-facing
instructions) and, where useful, a `scripts/` helper.

## Layout
```
review/                    # local runner, contracts and adapters
tests/review/              # automated acceptance tests
docs/review-runner.md       # supported usage and limits
skills/<name>/
  SKILL.md                 # YAML frontmatter (name, description) + the procedure
  scripts/*.mjs            # optional deterministic helper(s)
```

## Install

**As a submodule (recommended for a host repo with an existing skill installer):**
```
git submodule add https://github.com/DIGI-UW/code-qa tools/code-qa
```
Then point your installer's skill-scan at `tools/code-qa/skills` (for
OpenELIS-Global-2, `scripts/install-agent-skills.py` already scans skill roots — add
this path to `packaged_skills_roots`).

**Generic (copy into a host's `.claude/skills/`):**
```
node install.mjs --target /path/to/host-repo
```

## Requirements
- `evidence-bundle`: `ffmpeg` (webm→mp4) and `zip` on PATH.
- Local review runner: Node.js 20+ and Git. Acceptance tests also need Python 3. Optional model review: authenticated Codex or Claude CLI. Generic check execution: Docker. OpenELIS execution: Lima 2+, virtualization and sufficient build resources.

## Native gh stack reviews

Use a checkout already managed by `gh stack`. The harness reads the published
stack without checking out, rebasing, pushing or merging its branches:

```sh
node review/cli.mjs plan --stack --repo /path/to/feature-checkout --level L2 --out /path/to/evidence/stack-plan.json
node review/cli.mjs run --plan /path/to/evidence/stack-plan.json --out /path/to/evidence/runs
```

This reviews shared design, each PR's own diff, and combined behavior with one
reviewer. Level, provider/model and execution settings remain independent.
Use `--stack-layer PR_NUMBER` for a specific intermediate candidate and
`--previous-stack OLD_PLAN` when reassessing a restacked series. See the
[native stack guide](docs/stack-review.md) for evidence scope and supported limits.

## License
MIT — see [LICENSE](LICENSE).

## Local review harness (v0.6)

Review an existing PR without checking it out in an application worktree:

```sh
node review/cli.mjs review --pr https://github.com/OWNER/REPO/pull/NUMBER --level L2
```

| Level | What it does |
| --- | --- |
| L1 | Selected mechanical checks, zero model calls |
| L2 | Intent, ownership, callers/consumers and test adequacy review |
| L3 | Focused executed tests, applicable mutation/revert proof and bounded requested experiments |
| L4 | Running integration, loaded artifact identity, selected persistence/lifecycle scenarios |
| L5 | Full-stack selected journeys, saved outcomes and rendered comparison with product designs |

Levels select evidence, not model size. Codex and Claude share restricted source/evidence tools; provider/model, scope, environment and spending settings are independent. The development profile uses inexpensive Sol settings. Missing required evidence stays partial; no automatic model upgrade occurs. Claude image conformance is not yet claimed, so it cannot run L5.

Use the [runner guide](docs/review-runner.md) for commands and prerequisites, the [execution guide](docs/ogc-1560-review-harness/execution-guide.md) for check/probe/runtime inputs, and the [evaluation guide](docs/ogc-1560-review-harness/evaluation-guide.md) for repeated baseline comparisons. Run `npm test` and `npm run lint` without model credits.

The [checklist](docs/ogc-1560-review-harness/roadmap.md) separates implementation from acceptance. Real OpenELIS runtime/save/readback and rendered comparison have run; formal product sign-off is separate from completed design comparison. Quality labels and held-out adjudication require independent maintainers. The protected manual CI dispatcher is source-only; publication is a separate explicit command. The reviewer never repairs or merges.
