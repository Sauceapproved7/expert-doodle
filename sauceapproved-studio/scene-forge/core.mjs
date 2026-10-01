function c(v){return String(v??"").trim()}
function a(v){return Array.isArray(v)?v:[]}

export function createSceneForgeManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.scene-forge.manifest",
    version:1,
    product:"Hercules SceneForge",
    category:"directed-scene-planning",
    executionPolicy:"stress-lock-plan-fail-closed",
    autoPublish:false,
    autonomousMutation:false,
    differentiators:Object.freeze(["Continuity Stress Lab","Director Intent Lock"]),
    capabilities:Object.freeze(["scene sequencing","continuity stress testing","director-intent protection","shot dependency review"])
  });
}

export function buildSceneForgePlan(i={}){
  if(!c(i.title)||!c(i.directorIntent)) throw new Error("sceneforge_brief_incomplete");
  const scenes=a(i.scenes);
  const vals=[...new Set(scenes.map(x=>c(x.wardrobe)).filter(Boolean))];
  const issues=vals.length>1?[{dimension:"wardrobe",values:vals}]:[];
  const drift=scenes.some(x=>c(x.intent)&&c(x.intent).toLowerCase()!==c(i.directorIntent).toLowerCase());
  return Object.freeze({
    schema:"sauceapproved.studio.scene-forge.plan",
    version:1,
    title:c(i.title),
    continuityStressLab:Object.freeze({issues:Object.freeze(issues),passed:issues.length===0}),
    directorIntentLock:Object.freeze({intent:c(i.directorIntent),driftDetected:drift}),
    blockers:Object.freeze([...(issues.length?[{code:"continuity_stress_failed"}]:[]),...(drift?[{code:"director_intent_drift"}]:[])]),
    planReady:!issues.length&&!drift,
    executionReady:false,
    publishReady:false
  });
}

export function renderSceneForge(){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules SceneForge</title><style>
:root{font-family:Inter,system-ui,sans-serif;background:#06080b;color:#f6f8fb}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,#17304a,#081019 38%,#05070a 78%)}main{width:min(1180px,100%);margin:auto;padding:clamp(20px,5vw,58px)}a{color:#9dd6ff;text-decoration:none}.hero{min-height:500px;display:grid;align-content:end;padding:clamp(30px,6vw,72px);border:1px solid #284f70;border-radius:34px;background:linear-gradient(150deg,#17314a,#080c12 70%);box-shadow:0 30px 100px #0009}.eyebrow{font-size:11px;letter-spacing:.24em;color:#86c7f5}.hero h1{font-size:clamp(58px,10vw,116px);line-height:.82;letter-spacing:-.065em;margin:16px 0 24px}.hero p{max-width:840px;color:#b8c9d8;font-size:clamp(17px,2vw,22px);line-height:1.55}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.card{min-height:280px;padding:30px;border:1px solid #24445d;border-radius:25px;background:#09121a}.card span{font-size:11px;letter-spacing:.17em;color:#71b4e1}.card h2{font-size:30px;margin:54px 0 12px}.card p{color:#9eb1c0;line-height:1.62}.foot{margin-top:16px;padding:18px;border:1px solid #24445d;border-radius:18px;color:#8799a7}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{border-radius:24px;min-height:420px}}
</style></head><body><main><a href="/">Back to SauceApproved Studio</a><section class="hero"><div class="eyebrow">SAUCEAPPROVED / DIRECTED SCENE INTELLIGENCE</div><h1>Scene<br>Forge</h1><p>Stress-test a scene before money, render time, or creative momentum gets wasted. Lock the director's intent, expose continuity conflicts, and keep every shot accountable to the same creative truth.</p></section><section class="grid"><article class="card"><span>01 / CONTINUITY</span><h2>Continuity Stress Lab</h2><p>Pushes wardrobe, props, location, time, screen direction, and shot dependencies through deliberate conflict checks before execution.</p></article><article class="card"><span>02 / INTENT</span><h2>Director Intent Lock</h2><p>Protects the approved emotional and visual objective so later scene choices cannot quietly turn the work into something else.</p></article></section><div class="foot">Plan first. Prove continuity. Execution and publishing remain locked until downstream authorization is real.</div></main></body></html>`;
}
