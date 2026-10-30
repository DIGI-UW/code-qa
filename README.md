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
- Local review runner: Node.js 20+ and Git. Acceptance tests also need Python 3. Optional model review: Codex CLI. OpenELIS execution: Lima 2+, virtualization and sufficient build resources.

## License
MIT — see [LICENSE](LICENSE).

## Local review harness (v0.4)

**Implementation roadmap:** follow the [staged checklist](docs/ogc-1560-review-harness/roadmap.md). Stage 1 is in progress; the runner now distinguishes required evidence from execution settings.

Run a review of an existing PR:

```sh
node review/cli.mjs review --pr https://github.com/OWNER/REPO/pull/NUMBER --level L1
```

Choose L1 for deterministic checks or L2 for semantic review with explicit intent,
ownership, consumer and test assessments. L3–L5 require verification capabilities
that are still pending; they return partial before startup or model spend. Existing
declared OpenELIS checks remain usable with L1/L2.

The independent development profile defaults to one inexpensive Sol session.
Override the model explicitly; there is no core Sol/Luna allowlist. Reviewers inspect
pinned source on demand without a source-byte cap. No automatic model escalation occurs.

The [runner guide](docs/review-runner.md) includes installation, focused reviews,
limits, repository configuration and executable examples. Run `npm test` for
no-credit acceptance tests. The [implementation record](docs/ogc-1560-review-harness/implementation-status.md)
separates tested capabilities from remaining integrations and quality evaluation.
The [specification](docs/ogc-1560-review-harness/specification.md) defines the target contract; the checklist tracks implementation. Automatic publication, Claude integration and the model-quality pilot
are later work.
