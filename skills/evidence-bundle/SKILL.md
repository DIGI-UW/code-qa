---
name: evidence-bundle
description: |
  Turn a Playwright (or similar) E2E run into a structured, shareable proof —
  screenshots + MP4 videos + a narrated report — and draft the PR-comment and
  Slack message to surface it. Use after recording a demo/E2E run (e.g. a
  `core-demo-video` Playwright project) when you need to show a reviewer or
  stakeholder what a feature does and that it works, without polluting the repo
  with binaries. Pairs the deterministic bundler script with an LLM-written
  narrative. Drafts only — the human posts.
---

# evidence-bundle

Convert a recorded E2E run into a **structured, shareable proof** and draft how to
surface it. Leading agentic tools (Cursor, Devin, Copilot) all converge on one
convention: **binary evidence is PR-attached or platform-hosted, never committed
to the source tree.** This skill follows that — it produces a bundle for manual
attachment + a text index, and never commits the MP4s/PNGs.

## When to use
- After a demo/E2E video run, to package proof for a PR or Slack.
- When a reviewer needs to *see* a feature work, not just read the diff.
- NOT for committing media into the repo (see Repo hygiene below).

## Inputs you need
- The Playwright **results dir** (holds `<test>/video.webm`) — usually `test-results/`.
- The **screenshots dir** (loose `*.png` from `demo.evidence()` or similar) — e.g. `e2e-evidence/`.
- The **feature context**: what it is, the user stories/steps, and the validation
  numbers worth highlighting (from the test output, an API response, etc.).

## Procedure

### 1. Run the deterministic bundler
```
node scripts/evidence-bundle.mjs \
  --results <results-dir> --evidence <screenshots-dir> \
  --out <out-dir> --title "<Feature> (<TICKET>)"
```
It gathers screenshots + videos, converts webm→MP4 (H.264/yuv420p/+faststart so
they render inline on GitHub/Slack), and writes `<out-dir>/` with `screenshots/`,
`videos/`, `manifest.json`, a `README.md` **skeleton**, and a `.zip`. Setup-project
videos are excluded by default. The script does NOT narrate — that's the next step.

### 2. Fill the report (the README skeleton)
Read `manifest.json`, then replace every `<!-- FILL: ... -->` in `<out-dir>/README.md`:
- **One-paragraph summary** — what the feature is + the headline result.
- **Validation summary table** — the concrete proven facts (numbers/states), each
  with a "why it matters". Pull these from the actual run, not your assumptions.
- **Per-artifact captions** — map each screenshot/video to its user-story/step.
- **Test evidence** — the committed tests backing it (integration/component/E2E) + pass counts.
- Leave NO `<!-- FILL -->` behind; a half-filled report is a failure, not a draft.

Optionally rename videos in `videos/` to story-meaningful names (the script uses
the raw test-dir name) and update the README + manifest references to match.

### 3. Draft the surfaces (drafts only — do not post)
- **PR comment** — the summary + validation table as text, then a line telling the
  human to drag-drop the MP4s + key screenshots (GitHub renders MP4 inline from a
  comment upload; it does not need them committed). Show the draft; let the human post.
- **Slack message** — a 2-3 line summary + "bundle zip attached"; the human uploads
  the zip. Name the channel if known; never post without showing the draft first.

## Repo hygiene (do NOT skip)
- **Never commit** the MP4/PNG/zip. They are reproducible (re-run the E2E) and are
  the one model no leading tool follows. They are attachment/manual-share output.
- If a committed trace is wanted, commit only the **text** index (the filled
  `README.md`) under the feature's spec/evidence dir — consistent with specs-in-repo —
  with links to where the media was posted, not the media itself.

## Requirements
`ffmpeg` (webm→mp4) and `zip` (archive) on PATH. The script fails loudly if `ffmpeg`
is missing and warns (folder-only) if `zip` is missing.
