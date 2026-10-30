export function assessRuntime(identity, head) {
  const reasons=[];
  if(!identity || identity.head!==head || !Array.isArray(identity.components) || !identity.components.length) return {status:'error',reasons:['Missing runtime identity for this candidate']};
  for(const c of identity.components) {
    if(!c.name || !c.method || !c.expected || !c.observed) reasons.push('Incomplete loaded-component evidence');
    else if(c.expected!==c.observed) reasons.push(c.name+': loaded artifact differs from built candidate');
  }
  if(!identity.configuration || !identity.dependencies) reasons.push('Missing runtime configuration/dependency identity');
  return {status:reasons.length?'fail':'pass',reasons};
}
export function assessScenarios(scenarios, checks) {
  if(!Array.isArray(scenarios) || !scenarios.length) return ['No integration/lifecycle coverage declared'];
  const reasons=[];
  for(const s of scenarios) {
    if(!s.behavior?.trim() || !s.category || !s.reason?.trim()) reasons.push('Incomplete scenario applicability');
    if(s.applicable===false) continue;
    const check=checks.find(c=>c.id===s.checkId);
    if(!check || check.kind!=='scenario' || check.executed<1 || check.status==='error') reasons.push('Scenario lacks executed integration evidence: '+s.behavior);
  }
  if(!scenarios.some(s=>s.applicable!==false)) reasons.push('L4 needs an actual running integration path');
  return reasons;
}
