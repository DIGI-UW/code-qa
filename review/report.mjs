export const reviewerSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    schemaVersion: { type: 'integer', const: 1 }, head: { type: 'string' }, summary: { type: 'string' },
    coverage: { type: 'string', enum: ['complete', 'partial'] }, omissions: { type: 'array', items: { type: 'string' } },
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        title: { type: 'string' }, consequence: { type: 'string' }, owner: { type: 'string' },
        severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        evidence: { type: 'array', minItems: 1, items: {
          type: 'object', additionalProperties: false,
          properties: { kind: { type: 'string', enum: ['source', 'check'] }, path: { type: 'string' },
            side: { type: 'string', enum: ['base', 'head'] }, line: { type: 'integer' },
            checkId: { type: 'string' }, quote: { type: 'string' } },
          required: ['kind', 'path', 'side', 'line', 'checkId', 'quote'],
        } },
      }, required: ['title', 'consequence', 'owner', 'severity', 'evidence'],
    } },
  }, required: ['schemaVersion', 'head', 'summary', 'coverage', 'omissions', 'findings'],
};

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
  for (const finding of report.findings) {
    for (const name of ['title', 'consequence', 'owner']) if (!finding[name].trim()) throw new Error(`Empty finding ${name}`);
    for (const evidence of finding.evidence) {
      if (!evidence.quote.trim()) throw new Error('Empty evidence quotation');
      if (evidence.kind === 'source') {
        const file = packet.files.find(f => f.path === evidence.path && f.side === evidence.side);
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
export function renderReport(run) {
  const lines = ['# code-qa review', '', `Execution: **${run.status}**. Assessment: **${run.assessment}**.`, '',
    `Level: **${run.plan.level}**. Preset version: ${run.plan.presetVersion}. Model: ${run.plan.model || 'none'}.`,
    `Revision: ${run.plan.snapshot.head}`, `Application: ${run.plan.application}${run.plan.question ? ' — ' + run.plan.question : ''}`,
    `Environment: ${run.plan.environment}. Reviewer: ${run.plan.adapter}.`, '', '## Checks', ''];
  for (const check of run.checks) lines.push(`- ${check.id}: ${check.status}${check.executed !== undefined ? ` (${check.executed} assertions)` : ''}`);
  if (run.reviewer) {
    lines.push('', '## Reviewer assessment', '', run.reviewer.summary);
    for (const finding of run.reviewer.findings) {
      lines.push('', `- **${finding.severity}: ${finding.title}** — ${finding.consequence} Owner: ${finding.owner}.`);
      for (const evidence of finding.evidence) {
        if (evidence.kind === 'source') {
          const sha = evidence.side === 'head' ? run.plan.snapshot.head : run.plan.snapshot.mergeBase;
          const path = evidence.path.split('/').map(encodeURIComponent).join('/');
          const url = run.plan.pullRequest ? `https://github.com/${run.plan.pullRequest.repository}/blob/${sha}/${path}#L${evidence.line}` : null;
          const label = `${evidence.side}:${evidence.path}:${evidence.line}`;
          lines.push('', url ? `[${label}](${url})` : label, '', ...evidence.quote.split('\n').map(line => '> ' + line));
        } else lines.push('', `Check: ${evidence.checkId}`, '', '> ' + evidence.quote);
      }
    }
    lines.push('', 'Quoted evidence locations were checked. The semantic assessment remains the reviewer’s judgment, not independent confirmation.');
  }
  lines.push('', '## Scope', '', `Changed-file selection: ${run.plan.paths.length ? run.plan.paths.join(', ') : 'all changed files'}`,
    `Context files: ${run.plan.contextPaths.join(', ') || 'none'}`, `Focus: ${run.plan.lens || run.plan.question || 'general'}`,
    `Reviewer allowance: ${run.plan.reviewSeconds}s, ${run.plan.maxContextBytes} source bytes; ${run.plan.reasoningEffort} reasoning.`,
    `Explicit model/limit overrides: ${JSON.stringify(run.plan.overrides ?? {})}`,
    `Startup allowance: ${run.plan.startupSeconds}s; selected check allowances: ${run.plan.checks.map(c => c.id + '=' + c.timeoutSeconds + 's').join(', ') || 'none'}.`,
    ...run.plan.contextNotes.map(note => '- ' + note));
  if (run.plan.pullRequest) lines.push('', `PR: ${run.plan.pullRequest.url}. GitHub check snapshot collected at ${run.plan.pullRequest.observedAt}; see plan.json. This does not replace live CI status.`);
  if (run.reasons.length) lines.push('', '## Limits and failures', '', ...run.reasons.map(x => `- ${x}`));
  lines.push('', `Cleanup: ${run.cleanup}. AI sessions: ${run.usage.sessions}; billing: ${run.plan.billingMode}; reported usage: ${JSON.stringify(run.usage.reported ?? null)}.`,
    '', 'This report does not establish full CI health or mergeability. No code was repaired or published by the reviewer.', '');
  return lines.join('\n');
}
