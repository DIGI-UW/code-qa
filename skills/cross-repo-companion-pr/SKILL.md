---
name: cross-repo-companion-pr
description: |
  Manage a change that spans a primary code repo and a companion config/distro/data
  repo as paired pull requests — keeping them backward-compatible, cross-linked, and
  safe to merge independently. Use when a feature needs both a code change (new
  field/loader/behavior) AND a configuration/catalog/deployment change that lives in
  a separate repo, so neither PR is broken or confusing on its own.
---

# Cross-Repo Companion PR

Some features can't land in one repo: the code change lives in the primary repo, but
the data/config it consumes lives in a companion repo (a distro, a catalog, a
deployment config, a fixtures repo). Done naively this produces two PRs that each
look incomplete or, worse, a merge order that breaks an environment. This skill
keeps the pair coherent.

Use it when:
- a code change introduces a new field/loader/behavior that needs companion config
- the config/data lives in a separate repo (distro, catalog, deploy, fixtures)
- the two must be reviewable and mergeable without bricking each other

## The core discipline: degrade, don't depend

Design the **primary (code) PR to degrade cleanly when the companion config is
absent** — so it is safe to merge first, in any order, even into an environment that
doesn't have the companion yet. The companion PR then *enables* the richer behavior;
it never *gates* basic correctness.

Concretely:
- The code reads the new config defensively: missing → an honest "not configured"
  state, never a fabricated value or a crash.
- The companion change is **additive and backward-compatible**: an older build of the
  primary repo ignores the new column/key/file rather than failing to load.
- State this contract explicitly in both PR descriptions.

## Procedure

### 1. Split the change correctly
- **Primary repo:** the code + the degradation path (missing-config → safe state) +
  tests proving both the configured and unconfigured branches.
- **Companion repo:** the additive config/data, in that repo's own format and
  conventions (read its existing files first; match them exactly).

### 2. Open the pair, cross-linked
- Open both PRs against each repo's correct base branch (they often differ — e.g. a
  demo/feature branch in the primary, `main` in the companion).
- Each PR description links the other ("Consumed by …" / "Companion to …") and states
  the backward-compat contract and merge-order safety.

### 3. Verify both directions
- Primary without companion → the degradation path renders/behaves correctly (test it).
- Primary with companion → the full behavior works against real companion data
  (seed it locally or run the assembled stack).
- Companion loaded by an *older* primary build → no breakage (the additive guarantee).

### 4. Keep them in sync to merge
Track both PRs' CI; if review changes the config shape, update the code's reader (and
its tests) in lockstep. Neither merges "done" until its counterpart is green and the
cross-links are accurate.

## Output contract
- Two cross-linked PRs, each coherent on its own.
- The primary degrades cleanly without the companion (proven by a test).
- The companion is additive/backward-compatible (proven against an older build).
- Merge-order safety stated explicitly in both descriptions.

## Worked example
OpenELIS-Global-2 #3732 added a `test_result.significance` column + loader + a
dashboard that reads it; the companion `openelis-indonesia-distro` PR added the
`significance` values to the catalog CSV. The code PR reports `positivityConfigured:
false` and renders a "not configured" banner when the column is empty — so it merges
toward `develop` safely, and the distro PR lights it up.
