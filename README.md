# agentic-dev-skills

A small, project-agnostic suite of **agent skills for the verification & evidence
gap** — the part of agentic software development that off-the-shelf skills don't
cover. Generation chores (code review, commit messages, READMEs, changelogs) are
already commodified; the durable, under-served value is *proving the work is
correct and showing that it is*. These skills encode that discipline.

> Why this focus? Across the 2026 surveys, AI-generated changes still fail after
> passing QA, the majority need intervention, and most developers don't trust AI
> code without manual review. The bottleneck is verification, not generation.

## Skills

| Skill | What it does |
|---|---|
| **evidence-bundle** | Turn a Playwright/E2E run into a structured, shareable proof — screenshots + MP4 + a narrated report — and draft the PR/Slack surfaces. Deterministic bundler script + LLM narrative. |
| **meaningful-test-coverage** | Design + adversarially verify no-theater tests at the right level per layer; prove each guard would fail on the old code. Multi-agent workflow. |
| **spec-code-alignment** | Verify spec/design artifacts match the shipped code, catalog drift, remediate the lagging side — grounded in the code as source of truth. |
| **cross-repo-companion-pr** | Manage a change spanning a primary repo + a companion config/distro repo as paired, backward-compatible, cross-linked PRs. |
| **commit-pr-hygiene** | Team-specific commit/PR rules: format cold (defeat stale caches), timeless code comments, conventional trailer-clean messages, draft-before-posting. |

Each skill is a directory under `skills/<name>/` with a `SKILL.md` (the agent-facing
instructions) and, where useful, a `scripts/` helper or a `workflow.template.js`.

## Layout
```
skills/<name>/
  SKILL.md                 # YAML frontmatter (name, description) + the procedure
  scripts/*.mjs            # optional deterministic helper(s)
  workflow.template.js     # optional multi-agent workflow template
```

## Install

**As a submodule (recommended for a host repo with an existing skill installer):**
```
git submodule add https://github.com/DIGI-UW/agentic-dev-skills tools/agentic-dev-skills
```
Then point your installer's skill-scan at `tools/agentic-dev-skills/skills` (for
OpenELIS-Global-2, `scripts/install-agent-skills.py` already scans skill roots — add
this path to `packaged_skills_roots`).

**Generic (copy into a host's `.claude/skills/`):**
```
node install.mjs --target /path/to/host-repo
```

## Requirements
- `evidence-bundle`: `ffmpeg` (webm→mp4) and `zip` on PATH.
- The workflow-based skills assume an agent runtime with a `Workflow`/subagent tool.
