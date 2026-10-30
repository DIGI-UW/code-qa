export function validateScenarios(rows, checks) {
  if(!Array.isArray(rows))throw new Error('Scenarios must be an array');
  for(const row of rows) {
    if(!row.behavior?.trim() || !row.reason?.trim() || typeof row.applicable!=='boolean' || !['integration','persistence','negative','recovery','lifecycle','fresh-install','upgrade'].includes(row.category))throw new Error('Scenario needs behavior, category and applicability rationale');
    if(row.applicable && !checks.some(c=>c.id===row.checkId && c.kind==='scenario'))throw new Error('Applicable scenario needs an executable scenario check');
  }
}
export function validateWorkflows(rows, checks, designs) {
  if(!Array.isArray(rows))throw new Error('Workflows must be an array');
  const ids=new Set();
  for(const row of rows) {
    if(!/^[a-z][a-z0-9-]{0,63}$/.test(row.id) || ids.has(row.id) || !row.requirement?.trim())throw new Error('Workflow needs a unique ID and requirement');
    ids.add(row.id);
    if(!checks.some(c=>c.id===row.checkId && c.kind==='scenario'))throw new Error('Workflow needs a running scenario check');
    if(!row.visualInapplicableReason?.trim() && !designs.some(d=>d.id===row.designId))throw new Error('Workflow needs a design reference or visual applicability rationale');
  }
}
export function assessAcceptance(rows, report, checks, artifacts, designs) {
  const gaps=[],deviations=[],referenceNotes=[];
  if(!rows.length)return {gaps:['No selected product workflows'],deviations,referenceNotes};
  for(const row of rows) {
    const answer=report.acceptance?.find(a=>a.id===row.id);
    const check=checks.find(c=>c.id===row.checkId);
    if(!check || !['pass','fail'].includes(check.status) || check.executed<1)gaps.push('Workflow has no executed result: '+row.id);
    if(!answer || !answer.observedOutcome?.trim() || !answer.persistedOutcome?.trim()) {gaps.push('Missing observed user/saved-state outcome: '+row.id);continue;}
    if(answer.status==='unverified')gaps.push('Unverified acceptance: '+row.id+' — '+answer.reason);
    if(answer.status==='fail' || check?.status==='fail')deviations.push(row.id+': '+answer.reason);
    const evidence=answer.artifactIds.map(id=>artifacts.find(a=>a.id===id && a.checkId===row.checkId));
    if(evidence.some(a=>!a))gaps.push('Unknown workflow artifact: '+row.id);
    if(!evidence.some(a=>a?.kind==='readback' || a?.kind==='http'))gaps.push('Missing saved-state evidence: '+row.id);
    if(!row.visualInapplicableReason) {
      const reference=designs.find(d=>d.id===row.designId);
      if(reference?.approvalStatus!=='approved')referenceNotes.push(row.id+': reference status '+(reference?.approvalStatus??'unspecified')+'; comparison does not imply formal product approval');
      if(answer.designId!==row.designId || !designs.some(d=>d.id===row.designId) || !answer.designComparison.trim())gaps.push('Missing design comparison: '+row.id);
      if(!evidence.some(a=>a?.kind==='screenshot'))gaps.push('Missing rendered screenshot: '+row.id);
    }
  }
  return {gaps,deviations,referenceNotes};
}
