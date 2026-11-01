# OpenELIS review preparation

For a product/UI review, locate the existing mockups before asking the user for references:

1. Use [DIGI-UW/openelis-work](https://github.com/DIGI-UW/openelis-work), its `INDEX.md`, co-located designs and `mockup-viewer/src/App.jsx` registry. Search the workflow name, changed screen and Jira key. Prefer an existing checkout or fetch a pinned revision into the review cache.
2. Use the [published gallery](https://digi-uw.github.io/openelis-work/) to inspect the rendered reference. HTML previews retain their `designs/...html` paths on the published site; JSX-only views are in the gallery. The coordinator/helper discovers these; the restricted reviewer does not browse arbitrary sites.
3. Record the repository revision, source path, published URL, capture date and rendered reference image. A published page can be newer than a local checkout: note differences rather than silently equating them. Use the task's intended version when established.
4. Match the selected running workflow, screenshots, interactions and saved-state results to that reference. A Draft label is useful provenance; it does not stop the comparison or require a new approval. Report deviations, relevance and uncertainty. Review completion is separate from product sign-off.
5. Use designs only for goals, visible behavior, states and interaction/visual intent. Repository engineering specifications and code define APIs, entities, ownership, persistence and test layers. Technical-looking mock annotations are non-normative.
6. Ask only when the relevant references genuinely conflict or cannot be found after searching. Do not make the user rediscover routinely available mockups.

```sh
node review/cli.mjs designs --repo /path/to/openelis-work \
  --question 'OGC-285 label presets' --out /durable/label-design-candidates.json
```

The helper returns ranked candidates, pinned repository URLs and published previews. Render the selected mock in the isolated browser, retain its screenshot, and supply it with `--designs`; a candidate URL alone is not rendered evidence. For example, Label Presets uses `designs/admin-config/barcode-labels.html` and its co-located Markdown reference. This profile is part of review preparation, not an application implementation specification.
