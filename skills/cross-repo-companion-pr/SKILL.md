---
name: cross-repo-companion-pr
description: Review a change spanning code, configuration, distribution or data repositories as a coherent delivery. Identify compatible revisions and the required rollout order; create or update companion PRs only when the task authorizes delivery work.
---

# Cross-repository changes

Use the [shared review procedure](../review-change/SKILL.md). Trace the producer and consumer at explicit revisions, including the version actually deployed and the proposed combined change. Do not infer stack membership from branch names.

Choose the delivery strategy required by the accepted design:

- **Independent rollout:** preserve compatibility across the supported old/new combinations and test them.
- **Ordered migration:** state the dependency order, transitional behavior and removal point; test that sequence.
- **Atomic version set:** test the coordinated versions together and document deployment and rollback as a set.

Do not add fallback paths, dual interpretation or permanent compatibility machinery merely to permit arbitrary merge order. An approved cutover can deliberately require coordinated delivery. Conversely, do not remove compatibility that the actual rollout needs.

Keep code and configuration in their owning repositories. Cross-link the relevant PRs and specify exact dependency pins when authorized to publish them. Assess both individual changes and the assembled contract, including missing configuration where that is a supported state. Use existing stack/delivery tools; reviewing a contract does not itself authorize pushing or merging.

Report owners, supported version combinations, delivery order, executable evidence and unresolved dependencies. Keep local tests, CI, publication and merge status separate.
