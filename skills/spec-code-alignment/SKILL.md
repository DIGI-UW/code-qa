---
name: spec-code-alignment
description: |
  Verify that spec/design artifacts match the shipped code, catalog the drift, and
  remediate the lagging side — grounding every claim in the canonical source, not
  in what the spec says it should be. Use in spec-driven repos (SpecKit or similar)
  after implementation, before a PR or a review, when code and specs may have
  diverged. Read-only analysis first; remediate only the drift, only with approval.
---

# Spec ↔ Code Alignment

Use the [shared review procedure](../review-change/SKILL.md) for requirement authority and evidence.


In spec-driven workflows, the code and the written spec drift apart — usually
because a live design conversation got ahead of the paperwork. The job is not to
assume the spec is right and "fix" the code to match; it is to determine **which
side is authoritative for each item** and reconcile, with the code as the ground
truth for what actually ships.

Use it when:
- a feature was implemented through iteration and the spec/plan/tasks may lag
- you're prepping a PR or review and want the docs to match reality
- a `/speckit.analyze`-style pass flagged inconsistencies to remediate

## The key insight (from real runs)
Most drift is **code-ahead-of-spec**, not bugs: deliberate decisions landed in code
that the spec never caught up to. The analysis's real value is confirming the
*shape* of the drift — separating "doc lags a confirmed decision" (update the doc)
from "code diverged from an intended requirement" (a real defect). Don't dilute a
requirement to match a shortcut, and don't rewrite working code to match stale prose.

## Procedure

### 1. Analyze (read-only)
Load the spec artifacts (spec / plan / tasks / data-model / research, or your repo's
equivalents) and the shipped code. Build a requirements/Task inventory and map each
to the code that implements it. Run detection passes: duplication, ambiguity,
underspecification, coverage gaps, and **inconsistency between doc and code**
(terminology drift, entities/columns/flags in code but not the spec, or vice versa).
Produce a compact findings table (ID, severity, location, summary, recommendation).
**Ground every claim by reading the canonical source** (the code, the schema, the
build files) — never assert from the template or memory.

### 2. Classify each drift
For every finding, decide the authoritative side:
- **Doc lags a confirmed decision** → update the doc to match the code.
- **Code diverged from an intended requirement** → a real defect; fix the code (or
  escalate) — do NOT silently rewrite the requirement to match.
- **Both drifted / genuinely ambiguous** → surface for a human decision; don't guess.

### 3. Remediate (only with approval)
Edit the lagging artifact(s) to match reality. For SpecKit repos, prefer the
project's own commands (`/speckit.specify`, `/speckit.clarify`) over improvised
edits when the workflow mandates them; otherwise edit the artifacts directly and
faithfully. Commit the doc alignment alongside the feature change with a clear
message; rationale goes in the commit/PR, not in narrating code comments.

### 4. Verify clean
Re-grep for the stale claims you removed (old field names, deferred-feature notes,
superseded values). Zero hits = aligned. A remediation that leaves a contradicted
claim behind is not done.

## Output contract
- A findings table separating doc-lag from real code defects.
- The lagging artifacts updated to match shipped reality (or the defect filed/fixed).
- A grep-clean check proving no contradicted claims remain.
- Genuine ambiguities escalated to a human, not papered over.
