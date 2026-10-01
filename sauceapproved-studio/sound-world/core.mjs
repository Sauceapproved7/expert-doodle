function c(v){return String(v??"").trim()}
function a(v){return Array.isArray(v)?v:[]}

export function createSoundWorldManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.sound-world.manifest",
    version:1,
    product:"Hercules SoundWorld",
    category:"narrative-audio-design",
    executionPolicy:"map-memory-proof-fail-closed",
    autoPublish:false,
    autonomousMutation:false,
    differentiators:Object.freeze(["Audio Continuity Memory","Emotional Sound Mapping"]),
    capabilities:Object.freeze(["dialogue planning","ambience planning","foley planning","music direction","silence design","transition design"])
  });
}

export function buildSoundWorldPlan(i={}){
  if(!c(i.title)) throw new Error("soundworld_brief_incomplete");
  const beats=a(i.beats);
  const amb=[...new Set(beats.map(x=>c(x.ambience)).filter(Boolean))];
  const issues=amb.length>1?[{dimension:"ambience",values:amb}]:[];
  const map=beats.map((x,n)=>Object.freeze({beatId:c(x.id)||String(n+1),emotion:c(x.emotion),layers:Object.freeze(["dialogue","ambience","foley","effects","music","silence","transition"])}));
  return Object.freeze({
    schema:"sauceapproved.studio.sound-world.plan",
    version:1,
    title:c(i.title),
    audioContinuityMemory:Object.freeze({issues:Object.freeze(issues),passed:issues.length===0}),
    emotionalSoundMapping:Object.freeze(map),
    planReady:issues.length===0,
    executionReady:false,
    publishReady:false
  });
}

export function renderSoundWorld(){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules SoundWorld</title><style>
:root{font-family:Inter,system-ui,sans-serif;background:#050706;color:#f8faf7}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 78% 0,#1f4a38,#08130f 40%,#050706 78%)}main{width:min(1180px,100%);margin:auto;padding:clamp(20px,5vw,58px)}a{color:#a8f0ce;text-decoration:none}.hero{min-height:500px;display:grid;align-content:end;padding:clamp(30px,6vw,72px);border:1px solid #2c634d;border-radius:34px;background:linear-gradient(150deg,#173d2e,#07100c 72%)}.eyebrow{font-size:11px;letter-spacing:.24em;color:#8bd7b4}.hero h1{font-size:clamp(58px,10vw,116px);line-height:.82;letter-spacing:-.065em;margin:16px 0 24px}.hero p{max-width:830px;color:#bfd3c8;font-size:clamp(17px,2vw,22px);line-height:1.55}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.card{min-height:280px;padding:30px;border:1px solid #285240;border-radius:25px;background:#09130f}.card span{font-size:11px;letter-spacing:.17em;color:#78c89f}.card h2{font-size:30px;margin:54px 0 12px}.card p{color:#a6bdb1;line-height:1.62}.foot{margin-top:16px;padding:18px;border:1px solid #285240;border-radius:18px;color:#8fa69a}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{border-radius:24px;min-height:420px}}
</style></head><body><main><a href="/">Back to SauceApproved Studio</a><section class="hero"><div class="eyebrow">SAUCEAPPROVED / NARRATIVE AUDIO SYSTEM</div><h1>Sound<br>World</h1><p>Design what the audience feels before they can explain why. Build dialogue, ambience, foley, music, silence, effects, and transitions as one continuous emotional system.</p></section><section class="grid"><article class="card"><span>01 / MEMORY</span><h2>Audio Continuity Memory</h2><p>Tracks the sonic identity of spaces and scenes so ambience, dialogue texture, room tone, and recurring sound signatures do not drift without review.</p></article><article class="card"><span>02 / EMOTION</span><h2>Emotional Sound Mapping</h2><p>Maps every story beat to its intended emotional pressure and the audio layers that support it, including deliberate silence when silence is stronger.</p></article></section><div class="foot">Audio planning is owned and reviewable. Rendering, synthesis, likeness-sensitive voice work, and publishing remain proof- and consent-gated.</div></main></body></html>`;
}
