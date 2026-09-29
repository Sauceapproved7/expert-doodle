function clean(v){return String(v??'').trim();}
function arr(v){return Array.isArray(v)?v:[];}
export function createRealityForgeManifest(){
  return Object.freeze({
    schema:'sauceapproved.studio.reality-forge.manifest',version:1,
    product:'Hercules Reality Forge',category:'performance-preserving-world-transformation',
    executionPolicy:'plan-proof-transform-fail-closed',
    autoPublish:false,autonomousMutation:false,
    differentiators:Object.freeze(['Reality Lock','Continuity Guardian']),
    capabilities:Object.freeze(['environment replacement','era transformation','weather transformation','relighting','set dressing','VFX planning','camera-character planning'])
  });
}
function continuityGuardian(shots){
  const dimensions=['wardrobe','weather','timeOfDay','heroProp','screenDirection','location'];
  const conflicts=[];
  for(const dimension of dimensions){
    const values=[...new Set(shots.map(s=>clean(s?.continuity?.[dimension])).filter(Boolean))];
    if(values.length>1) conflicts.push(Object.freeze({dimension,values:Object.freeze(values),code:'continuity_conflict'}));
  }
  return Object.freeze({ok:conflicts.length===0,checkedDimensions:Object.freeze(dimensions),conflicts:Object.freeze(conflicts)});
}
export function buildRealityTransformationPlan(input={}){
  const title=clean(input.title),goal=clean(input.goal);
  if(!title||!goal) throw new Error('reality_forge_brief_incomplete');
  const protectedSubjects=arr(input.protectedSubjects).map(clean).filter(Boolean);
  const shots=arr(input.shots).map((shot,index)=>Object.freeze({
    order:index+1,id:clean(shot?.id)||'shot-'+String(index+1).padStart(2,'0'),
    subject:clean(shot?.subject),continuity:Object.freeze({...shot?.continuity}),
    transformationStatus:'planned',mutationAllowed:false
  }));
  const guardian=continuityGuardian(shots); const blockers=[];
  if(protectedSubjects.length && input.identityProof!==true) blockers.push(Object.freeze({code:'protected_identity_proof_required',gate:'reality-lock',ownerAction:true}));
  if(!guardian.ok) blockers.push(Object.freeze({code:'continuity_guardian_conflict',gate:'continuity-guardian',ownerAction:false}));
  const realityLock=Object.freeze({
    protectedSubjects:Object.freeze(protectedSubjects),identityProofVerified:input.identityProof===true,
    preserve:Object.freeze(['identity','performance timing','approved product geometry','approved brand marks']),
    policy:'changes-to-protected-elements-require-explicit-proof'
  });
  return Object.freeze({
    schema:'sauceapproved.studio.reality-forge.plan',version:1,title,goal,
    realityLock,continuityGuardian:guardian,shots:Object.freeze(shots),blockers:Object.freeze(blockers),
    planReady:blockers.length===0,executionReady:false,publishReady:false,mutationAttempted:false,
    nextGate:blockers.length?blockers[0].gate:'transformation-proof-review'
  });
}
export function renderRealityForge(){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Reality Forge</title><style>:root{font-family:Inter,system-ui,sans-serif;background:#050608;color:#f6f7fb}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 70% 0,#173947,#080d11 38%,#050608 75%)}main{width:min(1160px,100%);margin:auto;padding:clamp(20px,5vw,58px)}a{color:#8fe9ff;text-decoration:none}.hero{min-height:500px;display:grid;align-content:end;padding:clamp(28px,6vw,70px);border:1px solid #245260;border-radius:34px;background:linear-gradient(155deg,#102d37,#070a0d 72%);box-shadow:0 30px 100px #000b}.eyebrow{font-size:11px;letter-spacing:.23em;color:#80d9eb}.hero h1{font-size:clamp(55px,10vw,112px);line-height:.82;letter-spacing:-.065em;margin:14px 0 22px}.hero p{max-width:800px;color:#b7cbd1;font-size:clamp(17px,2vw,22px);line-height:1.55}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.card{padding:28px;min-height:270px;border:1px solid #1d3d46;border-radius:25px;background:#091116}.card span{font-size:11px;letter-spacing:.17em;color:#63b7ca}.card h2{font-size:30px;margin:50px 0 12px}.card p{color:#9db0b6;line-height:1.6}.foot{margin-top:16px;padding:18px;border:1px solid #1d3d46;border-radius:18px;color:#879ba1}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{border-radius:24px;min-height:420px}}</style></head><body><main><a href="/">Back to SauceApproved Studio</a><section class="hero"><div class="eyebrow">SAUCEAPPROVED / WORLD TRANSFORMATION ENGINE</div><h1>Reality<br>Forge</h1><p>Keep the performance. Rebuild the world. Transform era, environment, weather, lighting, set dressing, VFX, and camera character without letting protected identity or continuity quietly drift.</p></section><section class="grid"><article class="card"><span>01 / PROTECTION</span><h2>Reality Lock</h2><p>Locks approved people, performances, products, and brand-critical geometry before any world transformation can move toward execution.</p></article><article class="card"><span>02 / CONTINUITY</span><h2>Continuity Guardian</h2><p>Checks wardrobe, weather, time, props, geography, screen direction, and location logic across the transformed sequence before it can leave planning.</p></article></section><div class="foot">Plan → prove → transform. Mutation and publishing remain closed until the required proof gates clear.</div></main></body></html>`;
}
