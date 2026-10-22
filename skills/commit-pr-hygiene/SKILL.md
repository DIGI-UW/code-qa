---
name: commit-pr-hygiene
description: |
  Apply disciplined commit and pull-request hygiene before pushing — format with the
  repo's own tooling (and defeat stale formatter caches), write timeless code
  comments (no dev-path narration), keep commit messages conventional and trailer-
  clean, and follow the task authorization and repository publication policy for outward PR comments/reviews.
  Use before every commit and before opening or commenting on a PR.
---

# Commit & PR Hygiene

Off-the-shelf commit/PR-message generators exist; this skill is the thin layer of
*team-specific rules* that those don't enforce — the ones that cause CI failures,
noisy diffs, or awkward outward messages when skipped.

## Before every commit

1. **Format with the repo's own tooling, cold.** Run the project's formatter
   (backend + frontend) before staging. Beware **stale formatter caches**: a tool
   that tracks "already-clean" files can skip a file your IDE reformatted *after* it
   was cached — local check passes, CI (cold cache) fails. When a format gate fails
   in CI but passes locally, clear the cache and re-run (e.g. `rm -rf target/spotless-*`
   for Spotless), then commit the result.
2. **Stage deliberately.** Commit only the files the change touches; don't sweep in
   unrelated edits, build output, or submodule pointer bumps.
3. **Conventional commit message.** `type(scope): summary` (feat / fix / docs / test /
   style / refactor / chore). The subject says *what*; the body says *why*. Rationale,
   ticket numbers, and the fix journey go **here**, never in code comments.
4. **No `Co-Authored-By` trailer** (or any agent-attribution trailer) unless the repo
   explicitly asks for it.

## Code comments: timeless, not a changelog

Comments explain **non-obvious technical facts** for a future reader who has no idea a
change ever happened. They must NOT narrate the development path:
- ❌ ticket/PR numbers, "fixed the bug where…", "previously this used…", anecdotes.
- ✅ terse, present-tense statements of *why the code is the way it is* (an invariant,
  a gotcha, a non-obvious constraint). If it would read oddly in code written from
  scratch, it belongs in the commit message or PR, not the source.

## Outward actions

Use the task's explicit authorization and trusted repository publication policy. A preauthorized automated review may publish its bounded summary without asking again on each run. Otherwise prepare the concrete message before requesting the missing authorization. A review request alone does not authorize repairs, pushing, merging or resolving human discussions. The code-qa local runner does not publish anything.

## PR lifecycle

- **Open early, push often** — let CI run while you keep working; commit periodically
  rather than one giant drop.
- **Never declare "then merge."** The terminal state of a plan is *green CI + ready for
  review*, not "merged" — auto-merge is not assumed, and another author's PR gets a real
  review pass before "ready to merge."
- **Every CI failure is investigated**, never dismissed as "flaky" or "unrelated"
  without reading the actual failing log.

## Output contract
- Tree formatted with the repo's tooling (cache cleared if a cold-CI mismatch is possible).
- Conventional, trailer-clean commit message; rationale in the body, not in code.
- Code comments are timeless technical facts — zero dev-path narration.
- Any outward publication is within the task authorization and trusted repository policy.
