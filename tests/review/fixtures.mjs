// Synthetic coverage for protocol tests; live review quality is tested separately.
export const cleanReport = head => ({
  schemaVersion: 2, head, summary: 'Scoped source review completed.',
  coverage: 'complete', omissions: [], findings: [], questions: [],
  assessments: ['intent', 'ownership', 'consumers', 'tests'].map(area => ({
    area, status: 'assessed', reason: 'Synthetic ' + area + ' assessment for the protocol fixture.',
  })),
});
