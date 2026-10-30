---
name: simplicity-review
description: |
  Review a change for over-engineering and bloat — speculative generality,
  gold-plating, dead code, needless indirection, premature optimization, wrong
  abstractions — and propose the simplest version that still meets the spec and
  passes the tests. Use before opening a PR, and when auditing an AI-generated diff
  that feels larger than the problem. The mirror of meaningful-test-coverage: that
  fights too little verification, this fights too much code.
---

# Simplicity Review (anti-bloat)

Use the [shared review procedure](../review-change/SKILL.md) for requirement authority, evidence and legitimate code/test removal.

Over-engineering is a signature failure mode of code-generating agents: asked for a
registration form, an agent volunteers password reset, email verification, 2FA, and
account deletion. YAGNI is under constant threat. This gate catches the surplus
*before* it becomes maintenance debt — the goal is **right-sized**, neither bloated
nor under-built.

Use it when:
- a change is about to go up for review (especially an agent-written diff)
- the diff feels larger or more abstract than the problem it solves
- you're auditing a subsystem that has accreted complexity over iterations

## What to flag (each with a concrete simplification)

1. **Speculative generality** — abstractions, interfaces, generics, plugin points,
   or config/parameters with a *single* caller and no stated future need. Apply the
   **rule of three**: you need ~3 real use cases before the right abstraction is
   knowable; before that, inline it.
2. **Gold-plating** — features, options, branches, or error handling for cases the
   requirement never asked for. Map every code path back to a requirement; unmapped
   paths are candidates for deletion.
3. **Dead / unreachable code** — unused exports, params, branches, flags, helpers
   left "just in case."
4. **Needless indirection** — wrappers, factories, layers, or events that only pass
   through. If removing the layer changes nothing observable, remove it.
5. **Premature optimization** — caching, pooling, micro-tuning, or denormalization
   with no measured bottleneck. Complexity must be paid for by evidence, not a hunch.
6. **Wrong abstraction** — code DRY'd into a shared helper whose call-sites keep
   diverging (duplication would be simpler), or copy-paste that genuinely should be
   one function. Both directions are bloat.
7. **Config/flags for needs not present** — knobs no one will turn; hardcode until a
   second real consumer exists.

## Essential vs. accidental complexity (don't over-correct)
Not all complexity is bloat. Before flagging, ask: is this **essential** (inherent to
the problem/domain) or **accidental** (the solution's own weight)? A documented
requirement, a third real use case, a genuine performance measurement, or a
domain-mandated invariant **justifies** the complexity — leave it. The failure to
avoid here is stripping a load-bearing abstraction down to under-engineering.

## Procedure
1. **Anchor to the requirement.** Restate what the change actually needs to do (spec,
   ticket, the ask). Everything is measured against this, not against "what might be nice."
2. **Walk the diff** against the checklist above. For each finding: name it, cite the
   line(s), and write the *simpler* version (delete / inline / collapse / hardcode).
3. **Audit before patch.** In an over-engineered subsystem, map the architecture first
   — symptoms shift if you patch around the bloat instead of removing it.
4. **Verdict:** `lean` / `has-bloat` / `over-engineered`, with the prioritized cuts.
5. **If you cut, cut completely.** Dead-code deletion and de-abstraction ship in the
   *same* PR as the change — never "simplify later" as a dangling follow-up.

## Output contract
- A findings list: each over-engineering instance with file:line + the concrete simpler form.
- A verdict + a prioritized set of cuts (the simplest version that still meets the spec
  and preserves the required behavior, updating or deleting obsolete tests).
- Explicit "kept on purpose" notes for complexity that is essential (with the justification),
  so the review can't be mistaken for a push toward under-engineering.
