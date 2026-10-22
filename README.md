# code-qa

A small, project-agnostic suite of **agent skills that ensure shipped code is
properly reviewed, improved, and proven** — the verification & evidence gap that
off-the-shelf skills don't cover. Generation chores (code review summaries, commit
messages, READMEs, changelogs) are already commodified; the durable, under-served
value is *making sure what ships is correct and showing that it is*. These skills
encode that discipline.

> Why this focus? Across the 2026 surveys, AI-generated changes still fail after
> passing QA, the majority need intervention, and most developers don't trust AI
> code without manual review. The bottleneck is verification, not generation.

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
- Local review runner: Node.js 20+. Optional model review: Codex CLI. OpenELIS execution: Lima 2+, virtualization and sufficient build resources.

## License
MIT — see [LICENSE](LICENSE).

## Local review harness (v0.1)

The [runner guide](docs/review-runner.md) covers mechanical checks, one Codex reviewer,
and a disposable OpenELIS VM. Start with `node review/cli.mjs --help`; run the harness
acceptance tests with `npm test`. Model-assisted review is an explicit choice.

The [OGC-1560 specification](docs/ogc-1560-review-harness/specification.md) describes
the broader roadmap. The first version does not implement automatic PR publication,
Claude integration, Verified/Deep review or a model-quality pilot.
