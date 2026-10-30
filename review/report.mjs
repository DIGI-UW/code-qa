import { REVIEW_AREAS } from './levels.mjs';

export const reviewerSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    schemaVersion: { type: 'integer', const: 2 }, head: { type: 'string' }, summary: { type: 'string' },
    coverage: { type: 'string', enum: ['complete', 'partial'] }, omissions: { type: 'array', items: { type: 'string' } },
    assessments: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        area: { type: 'string', enum: REVIEW_AREAS },
        status: { type: 'string', enum: ['assessed', 'inapplicable', 'unverified'] },
        reason: { type: 'string' },
      }, required: ['area', 'status', 'reason'],
    } },
    questions: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: { question: { type: 'string' }, neededEvidence: { type: 'string' } },
      required: ['question', 'neededEvidence'],
    } },
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        title: { type: 'string' }, consequence: { type: 'string' }, owner: { type: 'string' },
        disposition: { type: 'string', enum: ['actionable', 'suggestion', 'refuted'] },
        counterevidence: { type: 'string' }, alternative: { type: 'string' },
        severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        evidence: { type: 'array', minItems: 1, items: {
          type: 'object', additionalProperties: false,
          properties: { sourceId:{type:'string'}, kind: { type: 'string', enum: ['source', 'check'] }, path: { type: 'string' },
            side: { type: 'string', enum: ['base', 'head'] }, line: { type: 'integer' },
            checkId: { type: 'string' }, quote: { type: 'string' } },
          required: ['kind', 'path', 'side', 'line', 'checkId', 'quote'],
        } },
      }, required: ['title', 'consequence', 'owner', 'severity', 'disposition', 'counterevidence', 'alternative', 'evidence'],
    } },
  }, required: ['schemaVersion', 'head', 'summary', 'coverage', 'omissions', 'assessments', 'questions', 'findings'],
};

const evidenceSchema = reviewerSchema.properties.findings.items.properties.evidence;
reviewerSchema.properties.priorFindings = { type: 'array', items: {
  type: 'object', additionalProperties: false,
  properties: { id: {type:'string'}, currentFindingId: {type:'string'}, status: {type:'string',enum:['still-present','resolved','superseded','declined','unverified']}, reason: {type:'string'}, evidence: {...evidenceSchema,minItems:0} },
  required: ['id','currentFindingId','status','reason','evidence'],
} };
reviewerSchema.properties.findings.items.properties.approach = {
  type:'object', additionalProperties:false,
  properties: Object.fromEntries(['problem','reachablePath','simplerAlternative','alternativeEvidence'].map(k => [k,{type:'string'}])),
  required:['problem','reachablePath','simplerAlternative','alternativeEvidence'],
};

reviewerSchema.properties.behaviors = {type:'array',items:{type:'object',additionalProperties:false,
  properties:{...Object.fromEntries(['behavior','requirement','layer','test','assertion','gap','checkId','probeId','applicabilityReason'].map(k=>[k,{type:'string'}])),gapStatus:{type:'string',enum:['none','open']},scope:{type:'string',enum:['in-scope','out-of-scope','inapplicable']}},
  required:['behavior','requirement','layer','test','assertion','gap','gapStatus','checkId','probeId'],
}};
reviewerSchema.properties.requestedChecks = {type:'array',items:{type:'object',additionalProperties:false,
  properties:{id:{type:'string'},reason:{type:'string'},falsifies:{type:'string'}},required:['id','reason','falsifies'],
}};
reviewerSchema.properties.acceptance={type:'array',items:{type:'object',additionalProperties:false,
  properties:{...Object.fromEntries(['id','reason','observedOutcome','persistedOutcome','designId','designComparison'].map(k=>[k,{type:'string'}])),status:{type:'string',enum:['pass','fail','unverified']},artifactIds:{type:'array',items:{type:'string'}}},
  required:['id','status','reason','observedOutcome','persistedOutcome','designId','designComparison','artifactIds'],
}};
export function verificationGaps(report, plan, checks, probes) {
  if (!plan.requiredEvidence.includes('test-strength')) return [];
  const gaps=[];
  if (!report.behaviors?.length) gaps.push('Missing behavior-to-test map');
  for(const b of report.behaviors ?? []) {
    if(['out-of-scope','inapplicable'].includes(b.scope)) {if(!b.applicabilityReason?.trim())gaps.push('Missing scope rationale: '+b.behavior);continue;}
    if(!b.behavior.trim() || !b.requirement.trim() || !b.layer.trim() || !b.assertion.trim()) gaps.push('Incomplete behavior-to-test assessment');
    if(b.gapStatus!=='none') gaps.push(b.behavior+': '+(b.gap || 'Unresolved verification gap'));
    if(!checks.some(c=>c.id===b.checkId && ['test','scenario'].includes(c.kind) && c.executed>0 && ['pass','fail'].includes(c.status))) gaps.push('Behavior lacks executed test: '+b.behavior);
    if(!probes.some(p=>p.id===b.probeId && ['detected','inapplicable'].includes(p.outcome))) gaps.push('Behavior lacks test-strength evidence: '+b.behavior);
  }
  return gaps;
}

// The CLI's schema request is not validation. Reject malformed or incomplete reports locally.
export function validateSchema(value, schema, label = 'report') {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected object`);
    for (const key of schema.required ?? []) if (!(key in value)) throw new Error(`${label}: missing ${key}`);
    for (const [key, child] of Object.entries(value)) {
      if (!(key in schema.properties)) throw new Error(`${label}: unexpected ${key}`);
      validateSchema(child, schema.properties[key], `${label}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0)) throw new Error(`${label}: invalid array`);
    value.forEach((child, i) => validateSchema(child, schema.items, `${label}[${i}]`));
  } else if (schema.type === 'integer' ? !Number.isInteger(value) : typeof value !== schema.type) throw new Error(`${label}: invalid type`);
  if (schema.const !== undefined && value !== schema.const) throw new Error(`${label}: invalid constant`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${label}: invalid value`);
}
export function validateReviewer(report, packet, checks) {
  validateSchema(report, reviewerSchema);
  if (report.head !== packet.snapshot.head) throw new Error('Reviewer returned a different head; it will not be overwritten');
  if (!report.summary.trim()) throw new Error('Reviewer summary is empty');
  const areas = new Set();
  for (const assessment of report.assessments) {
    if (areas.has(assessment.area) || !assessment.reason.trim()) throw new Error('Duplicate area or empty coverage rationale');
    areas.add(assessment.area);
    if (['intent', 'ownership'].includes(assessment.area) && assessment.status === 'inapplicable') throw new Error('Intent and ownership cannot be inapplicable');
  }
  for (const question of report.questions) if (!question.question.trim() || !question.neededEvidence.trim()) throw new Error('Empty unresolved question/evidence request');
  for (const finding of report.findings) {
    if (finding.approach && Object.values(finding.approach).some(v => !v.trim())) throw new Error('Approach objection needs problem, reachable path and supported alternative');
    for (const name of ['title', 'consequence', 'owner', 'counterevidence']) if (!finding[name].trim()) throw new Error(`Empty finding ${name}`);
    for (const evidence of finding.evidence) {
      if (!evidence.quote.trim()) throw new Error('Empty evidence quotation');
      if (evidence.kind === 'source') {
        const file = packet.files.find(f => f.path === evidence.path && f.side === evidence.side && (f.sourceId ?? '') === (evidence.sourceId ?? ''));
        const lines = file?.text.split('\n');
        const line = lines?.[evidence.line - 1];
        const column = line?.indexOf(evidence.quote.split('\n')[0]) ?? -1;
        if (evidence.line < 1 || column < 0 || !lines.slice(evidence.line - 1).join('\n').slice(column).startsWith(evidence.quote)) throw new Error('Source evidence does not match the recorded file/line');
      } else {
        const check = checks.find(c => c.id === evidence.checkId);
        if (!check || !JSON.stringify(check).includes(evidence.quote)) throw new Error('Check evidence does not match this run');
      }
    }
  }
  return report;
}
// Area assessments remain reviewer judgments, not independent factual proof.
// The runner checks coverage rather than trusting a "complete" label alone.
export function coverageGaps(report) {
  const missing = REVIEW_AREAS.filter(area => !report.assessments.some(a => a.area === area));
  return [
    ...missing.map(area => 'Missing assessment: ' + area),
    ...report.assessments.filter(a => a.status === 'unverified').map(a => a.area + ': ' + a.reason),
    ...report.questions.map(q => q.question + ' Needed evidence: ' + q.neededEvidence),
  ];
}
export const actionableFindings = report => report?.findings.filter(f => f.disposition === 'actionable') ?? [];

export function renderReport(run) {
  const lines = ['# code-qa review', '', `Execution: **${run.status}**. Assessment: **${run.assessment}**.`, '',
    `Level: **${run.plan.level}**. Evidence contract: ${run.plan.presetVersion}. Execution profile: ${run.plan.profile}. Model: ${run.plan.model || 'none'}.`,
    `Revision: ${run.plan.snapshot.head}`, `Application: ${run.plan.application}${run.plan.question ? ' — ' + run.plan.question : ''}`,
    `Environment: ${run.plan.environment}. Reviewer: ${run.plan.adapter}.`, '', '## Required evidence', '', ...run.plan.requiredEvidence.map(x => '- ' + x), '', '## Checks', ''];
  for (const check of run.checks) lines.push(`- ${check.id}: ${check.status}${check.executed !== undefined ? ` (${check.executed} ${check.measure ?? 'assertions'})` : ''}`);
  if(run.probes?.length) lines.push('', '## Test-strength probes', '', ...run.probes.map(p=>'- '+p.id+': '+p.outcome+(p.reason?' — '+p.reason:'')));
  if (run.reviewer) {
    if(run.reviewer.behaviors?.length) lines.push('', '## Behavior and test coverage', '', ...run.reviewer.behaviors.map(b=>'- '+b.behavior+' ['+(b.scope ?? 'in-scope')+']: '+b.layer+'; test '+(b.test || 'missing')+'; assertion '+b.assertion+(b.gap?' — Gap: '+b.gap:'')));
    lines.push('', '## Reviewer assessment', '', run.reviewer.summary);
    lines.push('', '## Coverage', '', ...run.reviewer.assessments.map(a => '- ' + a.area + ': ' + a.status + ' — ' + a.reason));
    if (run.reviewer.questions.length) lines.push('', '## Unresolved questions', '',
      ...run.reviewer.questions.map(q => '- ' + q.question + ' Needed evidence: ' + q.neededEvidence));
    for (const finding of run.reviewer.findings) {
      lines.push('', `- **${finding.severity} / ${finding.disposition}: ${finding.title}** — ${finding.consequence} Owner: ${finding.owner}.`);
      lines.push('', 'Counterevidence considered: ' + finding.counterevidence);
      if (finding.alternative) lines.push('', 'Alternative: ' + finding.alternative);
      for (const evidence of finding.evidence) {
        if (evidence.kind === 'source') {
          const attached=evidence.sourceId ? run.plan.sources?.find(s=>s.id===evidence.sourceId) : null;
          const sha = attached?.revision ?? (evidence.side === 'head' ? run.plan.snapshot.head : run.plan.snapshot.mergeBase);
          const path = evidence.path.split('/').map(encodeURIComponent).join('/');
          const url = run.plan.pullRequest ? `https://github.com/${attached?.repository ?? run.plan.pullRequest.repository}/blob/${sha}/${path}#L${evidence.line}` : null;
          const label = `${attached?.repository ?? evidence.side}@${sha}:${evidence.path}:${evidence.line}`;
          lines.push('', url ? `[${label}](${url})` : label, '', ...evidence.quote.split('\n').map(line => '> ' + line));
        } else lines.push('', `Check: ${evidence.checkId}`, '', '> ' + evidence.quote);
      }
    }
    lines.push('', 'Quoted evidence locations were checked. The semantic assessment remains the reviewer’s judgment, not independent confirmation.');
  }
  lines.push('', '## Scope', '', `Changed-file selection: ${run.plan.paths.length ? run.plan.paths.join(', ') : 'all changed files'}`,
    `Context files: ${run.plan.contextPaths.join(', ') || 'none'}`, `Focus: ${run.plan.lens || run.plan.question || 'general'}`,
    `Reviewer allowance: ${run.plan.reviewSeconds}s; repository inspection without a source-byte cap; ${run.plan.reasoningEffort} reasoning.`,
    `Explicit model/limit overrides: ${JSON.stringify(run.plan.overrides ?? {})}`,
    `Startup allowance: ${run.plan.startupSeconds}s; selected check allowances: ${run.plan.checks.map(c => c.id + '=' + c.timeoutSeconds + 's').join(', ') || 'none'}.`,
    ...run.plan.contextNotes.map(note => '- ' + note));
  if (run.plan.pullRequest) lines.push('', `PR: ${run.plan.pullRequest.url}. GitHub check snapshot collected at ${run.plan.pullRequest.observedAt}; see plan.json. This does not replace live CI status.`);
  if (run.reasons.length) lines.push('', '## Limits and failures', '', ...run.reasons.map(x => `- ${x}`));
  lines.push('', `Cleanup: ${run.cleanup}. AI sessions: ${run.usage.sessions}; billing: ${run.plan.billingMode}; reported usage: ${JSON.stringify(run.usage.reported ?? null)}.`,
    '', 'This report does not establish full CI health or mergeability. No code was repaired or published by the reviewer.', '');
  return lines.join('\n');
}
