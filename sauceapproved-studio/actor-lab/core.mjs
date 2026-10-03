function c(v){return String(v??"").trim()}
function a(v){return Array.isArray(v)?v:[]}

export function createActorLabManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.actor-lab.manifest",
    version:1,
    product:"Hercules Actor Lab",
    category:"character-continuity-and-role-control",
    executionPolicy:"contract-consent-simulate-fail-closed",
    autoPublish:false,
    autonomousMutation:false,
    differentiators:Object.freeze(["Character Contract Ledger","Role Boundary Simulator"]),
    capabilities:Object.freeze(["character bible","role continuity","likeness consent gating","voice and mannerism protection","scene-role simulation"])
  });
}

export function buildActorLabPlan(i={}){
  if(!c(i.name)) throw new Error("actor_lab_name_required");
  const traits=Object.freeze({...i.traits});
  const role=c(i.traits?.role);
  const drift=a(i.scenes).some(x=>c(x.role)&&c(x.role)!==role);
  const blockers=[];
  if(i.usesRealPersonLikeness===true&&i.consentProof!==true) blockers.push({code:"likeness_consent_required"});
  if(drift) blockers.push({code:"role_boundary_review_required"});
  return Object.freeze({
    schema:"sauceapproved.studio.actor-lab.plan",
    version:1,
    name:c(i.name),
    characterContractLedger:Object.freeze({traits,protectedDimensions:Object.freeze(["appearance","wardrobe","personality","voice","mannerisms","role"])}),
    roleBoundarySimulator:Object.freeze({baselineRole:role,driftDetected:drift,simulationOnly:true}),
    blockers:Object.freeze(blockers),
    planReady:blockers.length===0,
    executionReady:false,
    publishReady:false
  });
}

export function renderActorLab(){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Actor Lab</title><style>
:root{font-family:Inter,system-ui,sans-serif;background:#080607;color:#fff8f5}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#532b2e,#160b0d 40%,#080607 78%)}main{width:min(1180px,100%);margin:auto;padding:clamp(20px,5vw,58px)}a{color:#ffc1bd;text-decoration:none}.hero{min-height:500px;display:grid;align-content:end;padding:clamp(30px,6vw,72px);border:1px solid #704044;border-radius:34px;background:linear-gradient(150deg,#401f23,#0c0809 72%)}.eyebrow{font-size:11px;letter-spacing:.24em;color:#efa5a2}.hero h1{font-size:clamp(58px,10vw,116px);line-height:.82;letter-spacing:-.065em;margin:16px 0 24px}.hero p{max-width:830px;color:#d7bdba;font-size:clamp(17px,2vw,22px);line-height:1.55}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.card{min-height:280px;padding:30px;border:1px solid #5a3437;border-radius:25px;background:#140c0d}.card span{font-size:11px;letter-spacing:.17em;color:#dc8f8c}.card h2{font-size:30px;margin:54px 0 12px}.card p{color:#bca4a2;line-height:1.62}.foot{margin-top:16px;padding:18px;border:1px solid #5a3437;border-radius:18px;color:#a58f8e}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{border-radius:24px;min-height:420px}}
</style></head><body><main><a href="/">Back to SauceApproved Studio</a><section class="hero"><div class="eyebrow">SAUCEAPPROVED / CHARACTER CONTROL SYSTEM</div><h1>Actor<br>Lab</h1><p>Build a character once, then protect what makes that character recognizable. Keep role, appearance, wardrobe, voice, mannerisms, and personality consistent across scenes without treating a likeness as free material.</p></section><section class="grid"><article class="card"><span>01 / CONTRACT</span><h2>Character Contract Ledger</h2><p>Turns approved character traits into protected dimensions that downstream Studio systems can reference instead of improvising them again.</p></article><article class="card"><span>02 / BOUNDARIES</span><h2>Role Boundary Simulator</h2><p>Shows when a scene is pushing a character outside the approved role before any likeness-sensitive or performance-sensitive execution can happen.</p></article></section><div class="foot">Real-person likeness and voice remain consent-gated. Planning is not consent, execution permission, or publication permission.</div></main></body></html>`;
}
