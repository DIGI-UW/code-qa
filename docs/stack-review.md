# Reviewing native gh stacks

The stack is the review unit for a feature delivered through `gh stack`. GitHub
and `gh stack` continue to own branch management. code-qa reads their state; it
does not maintain another stack database or silently rebase branches.

## First review

Prerequisites: Node.js 20+, Git, authenticated `gh`, and a `gh stack` version
supporting `view --json`. Start from a local checkout of the intended stack. All
active layers must have published PRs and local heads must match published heads.
If the stack is only on GitHub, check it out explicitly with `gh stack checkout`
first. The review command does not perform that mutation on your behalf.

```sh
node review/cli.mjs plan --stack --repo /path/to/feature-checkout \
  --level L2 --lens security --out /path/to/evidence/stack-plan.json
node review/cli.mjs run --plan /path/to/evidence/stack-plan.json \
  --out /path/to/evidence/runs
```

`review --stack` combines those steps. L1 runs mechanical checks with zero model
calls. L2 uses one reviewer for design, each layer, and the combined candidate;
it does not create an independent model session per PR. Source inspection has no
aggregate byte limit. Provider/model and time settings remain explicit and
independent of levels. Large stacks that cannot be covered in the selected time
remain partial; select layers or increase the allowance explicitly.

Default execution configuration and accepted requirement files come from the stack
trunk revision, even for a selected upper layer. Unmerged parent PR configuration
is not trusted automatically; an explicit operator `--config` still overrides it.

The plan pins the active PR order, current remote trunk/base, every PR base/head
and merge base, checks, review conversation and exact combined head. `primary`
is the combined trunk-to-top range. `pr-N` sources expose each PR's own diff and
both versions of its files. Dependencies from `--sources` remain separately
identified. Merged bottom layers are excluded; a merged layer inside the active
chain or a mismatched PR dependency order needs explicit synchronization first.

Collection and the start/end of execution check stack membership and all PR
revisions. A stable snapshot can still need restacking: if a child omits its
current parent, the report names that gap and cannot claim current-stack
completion. The harness may inspect that historical candidate; it does not
invent compatibility code or repair branches.

## Review sequence and evidence

1. Establish intended behavior and component ownership, including accepted
   deletions. Review the combined design before chasing individual failures.
2. Inspect layers bottom to top, their relevant tests and unchanged callers.
3. Trace producers to consumers at the top. Look for later changes that undo,
   bypass or duplicate earlier work.
4. Map important behaviors to useful tests and selected mutation/revert probes.
5. Run the combined candidate's applicable integration and user workflows.

The reviewer must report coverage for design, every current layer and combined
behavior. The generated output schema restricts coverage IDs to those selected stack entries. Attached consumer/dependency IDs belong in the consumers assessment and combined rationale, not in `stackCoverage`. Missing or unverified entries produce partial coverage. This checks
report completeness, not whether the model's judgment is correct.

Levels keep their existing evidence obligations. Choose L3 for meaningful
behavior/test-strength questions, L4 for running integration and L5 for affected
user journeys and design comparison. Do not run every level or mutation for every
PR merely because it belongs to a stack. Supplied checks execute only on the
selected candidate; every check and runtime result retains that revision.

For intermediate states intended to merge independently, select that PR and
provide its applicable checks/configuration:

```sh
node review/cli.mjs plan --stack --repo /path/to/feature-checkout \
  --stack-layer 123 --level L3 --config /path/to/trusted-layer-checks.json \
  --out /path/to/evidence/layer-123.json
```

A passing top cannot clear a broken intermediate state. Combined L1 checks include
whitespace for every layer as well as the top. Build/test/runtime execution is not
automatically repeated for every prefix. Configure only meaningful intermediate
checks. Cross-repository rollout combinations remain explicit; no automatic
Cartesian compatibility matrix or arbitrary dependency merging is performed.

## Re-review after gh stack rebase/submit

```sh
node review/cli.mjs plan --stack --repo /path/to/feature-checkout \
  --previous-stack /path/to/evidence/stack-plan.json \
  --history /path/to/evidence/runs/OLD_RUN/history.json \
  --level L2 --out /path/to/evidence/restacked-plan.json
```

The previous plan must identify the same repository and trunk; its pinned Git
objects must still be available. Previous layers are available as `previous-pr-N`.
Comparisons identify added/removed/changed layers and parent changes, with Git's
human-readable `range-diff`. The latter is never parsed into an approval or cache
key. A different SHA does not necessarily mean different behavior, and an
identical patch on a different parent does not guarantee the same behavior.

Old tests/runtime evidence are not automatically reused. Prior findings remain
separate from the previous source plan; `--history` requests current dispositions
with evidence. Missing dispositions remain unverified. Re-review does not
silently resolve GitHub threads.

## Finding ownership and publication

An actionable stack finding must identify the current owning `pr-N` or attached
consumer/dependency source. The report can cite several layers but should state
a shared defect once. Publication remains a separate operator-authorized action:

```sh
node review/cli.mjs publish --result /path/to/evidence/runs/RUN/result.json \
  --finding FINDING_ID --verified FINDING_ID --authorize-publication
```

Publish selections for one owning PR at a time. The command rechecks the entire
stack, then posts against that PR's exact reviewed head. A dependency finding
outside this stack needs its own PR review before publication. Previously
published findings with matching identities or explicit history mappings are
reported as duplicates, including across rebases. Findings linked to an existing
GitHub thread also return that discussion without posting another review; inspect the existing review
for any required thread follow-up. The harness does not automatically reply,
resolve threads or infer that differently worded findings are the same defect.

## Current boundaries

- Native local gh stacks with published PRs are supported. Arbitrary GitHub PR
  lists are not guessed into a stack.
- Combined means the current stack top with its declared dependency pins. It
  does not mean a speculative merge of independent stacks or unpinned repositories.
- Review, runtime verification, current CI status and human merge approval are
  separate results. Existing CI snapshots are context, not executed harness tests.
- The hosted source-review workflow remains single-PR; native stack use is via
  the CLI or agent tooling with an explicit stack checkout.
- Automated fixtures establish correct coordination, not independently measured
  AI review quality. The held-out quality evaluation remains open.

## Basis

- [GitHub stack design](https://github.com/github/gh-stack/blob/main/skills/gh-stack/references/stack-design.md)
- [Google: overall design before detail](https://google.github.io/eng-practices/review/reviewer/navigate.html)
- [Google: cohesive changes with tests](https://google.github.io/eng-practices/review/developer/small-cls.html)
- [OpenClinAI stack review](https://github.com/pmanko/openclinai.org/blob/26d0e53b24c6cb899370ee5c69c800b2f17020e1/review/briefs/stack.md)
- [Daniel's problem-first verified review](https://github.com/openmrs/openmrs-module-querystore/blob/72df9d938b1996bc3eb2f073adb0cea958ee9d1e/.claude/skills/pr-review/SKILL.md)
- [Git range-diff](https://git-scm.com/docs/git-range-diff)
- [Practical Mutation Testing at Scale](https://arxiv.org/abs/2102.11378)
