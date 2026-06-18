// Meaningful-test-coverage workflow template. Pass:
//   args = { context, infra?, layers?: [{ key, focus }, ...] }
// - context: the change + the bug being fixed, INCLUDING the OLD buggy behavior
//   (so the inversion guard can be checked).
// - infra (optional): your stack's test infrastructure per level (frameworks +
//   how to run each) — calibrates the generic levels to your project.
// - layers (optional): the levels to cover; defaults to integration/unit/component/e2e.
// Invoke: Workflow({ scriptPath: ".../workflow.template.js", args })
export const meta = {
  name: 'meaningful-test-coverage',
  description: 'Design + adversarially verify no-theater tests at each layer of a change, then synthesize a prioritized plan',
  phases: [
    { title: 'Design', detail: 'one agent per layer: correct test level + concrete test code + "would it fail on old code?"' },
    { title: 'Verify', detail: 'adversarial skeptic per design: theater / over-mock / wrong-level / inversion-guard validity' },
    { title: 'Synthesize', detail: 'merge into a prioritized plan naming the single layer that guards the core bug' },
  ],
}

const CONTEXT = (args && args.context) || 'NO CONTEXT PASSED — describe the change and the OLD buggy behavior.';
const INFRA = (args && args.infra) ||
  'Calibrate to your stack: integration = real backend (e.g. ephemeral DB / Testcontainers); ' +
  'unit = mock collaborators; component = a component test runner; e2e = a browser driver.';
const LAYERS = (args && args.layers) || [
  { key: 'integration', focus: 'where a real-backend bug (DB query / ORM / schema / column mapping) can only fail against a real datastore' },
  { key: 'unit', focus: 'pure logic (math / branching / mapping) with collaborators mocked; must disclaim what the mock hides' },
  { key: 'component', focus: 'rendering + degraded/empty states; assert real output for happy AND degraded inputs' },
  { key: 'e2e', focus: 'the assembled story across the running stack; visible-state assertions only' },
];

const RULES = `
TEST-QUALITY RULES — obey strictly:
- Right level for what can fail. A data/query bug needs an integration test against a real backend; a mocked test asserting the same thing is THEATER.
- The inversion test: a guard must FAIL on the OLD buggy behavior. Answer "would this fail if the fix were reverted?" precisely.
- No assert-on-mock-return. No over-mocking the unit under test. No verify-only tests that still pass if the behavior is dropped.
- Honest disclaimers: a level that cannot cover something must say so in the test, not pretend.
STACK INFRA: ${INFRA}
`;

const DESIGN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['layer','testLevel','rationale','testFilePath','keyAssertions','theaterRisksAvoided','fixtures','testCode','catchesInversion'],
  properties: {
    layer: { type: 'string' }, testLevel: { type: 'string', enum: ['unit','integration','component','e2e','none'] },
    rationale: { type: 'string' }, testFilePath: { type: 'string' },
    keyAssertions: { type: 'array', items: { type: 'string' } },
    theaterRisksAvoided: { type: 'array', items: { type: 'string' } },
    fixtures: { type: 'string' }, testCode: { type: 'string' },
    catchesInversion: { type: 'string', description: 'would this FAIL on the old code? or "N/A — wrong level for the inversion"' },
  },
};
const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['meaningful','correctLevel','overMocked','theaterDetected','inversionGuardValid','issues','requiredChanges','verdict'],
  properties: {
    meaningful: { type: 'boolean' }, correctLevel: { type: 'boolean' }, overMocked: { type: 'boolean' },
    theaterDetected: { type: 'boolean' }, inversionGuardValid: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } }, requiredChanges: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string', enum: ['solid','needs-revision','theater-reject'] },
  },
};
const SYNTH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['summary','coverageByLayer','gaps','implementationOrder'],
  properties: {
    summary: { type: 'string' },
    coverageByLayer: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['layer','level','file','status'], properties: { layer:{type:'string'}, level:{type:'string'}, file:{type:'string'}, status:{type:'string'} } } },
    gaps: { type: 'array', items: { type: 'string' } },
    implementationOrder: { type: 'array', items: { type: 'string' } },
  },
};

phase('Design')
const perLayer = await pipeline(
  LAYERS,
  (layer) => agent(`${CONTEXT}\n${RULES}\n\n=== YOUR LAYER: ${layer.key} ===\n${layer.focus}\nRead the actual changed files + existing test conventions before designing. Produce the ONE meaningful test (or set) at the correct level, with concrete code. Answer catchesInversion honestly.`,
    { label: `design:${layer.key}`, phase: 'Design', schema: DESIGN_SCHEMA }),
  (design, layer) => agent(`${CONTEXT}\n${RULES}\n\nAdversarially REVIEW this test for layer "${layer.key}". Hunt for theater. Would it FAIL on the OLD code? Over-mocked? Asserts on mock returns? Default to skepticism.\n\nDESIGN:\n${JSON.stringify(design)}`,
    { label: `verify:${layer.key}`, phase: 'Verify', schema: VERDICT_SCHEMA }).then((verdict) => ({ layer: layer.key, design, verdict })),
);

phase('Synthesize')
const synthesis = await agent(`${CONTEXT}\n${RULES}\n\nMerge these per-layer designs + verdicts into a prioritized no-theater test plan. Name the single layer that genuinely guards the core bug. Flag every theater-reject/needs-revision with its fix. Give a concrete implementation order.\n\n${JSON.stringify(perLayer)}`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA });

return { perLayer, synthesis };
