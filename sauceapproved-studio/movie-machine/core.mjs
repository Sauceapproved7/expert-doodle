const DIFFERENTIATORS=Object.freeze(["Director's Proof Map","Emotion-to-Camera Graph","Continuity Spine"]);

function clean(value){return String(value??"").trim();}
function number(value,fallback){const n=Number(value);return Number.isFinite(n)&&n>0?n:fallback;}
function esc(value){return clean(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}

export function createMovieMachineManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.movie-machine.manifest",
    version:1,
    product:"Hercules Movie Machine",
    category:"cinematic-production",
    executionPolicy:"plan-first-fail-closed",
    providerRequiredForRender:true,
    renderProviderConnected:false,
    differentiators:DIFFERENTIATORS,
    competitionGapFeatures:Object.freeze(["Director's Proof Map","Emotion-to-Camera Graph"]),
    outputs:Object.freeze(["three-act architecture","scene graph","continuity spine","camera intent map","audio arc","director proof map"])
  });
}

const ACTS=Object.freeze([
  Object.freeze({id:"act-1",label:"Ignition",purpose:"Establish world, pressure, and emotional promise."}),
  Object.freeze({id:"act-2",label:"Pressure",purpose:"Escalate consequence, choice, and visual movement."}),
  Object.freeze({id:"act-3",label:"Payoff",purpose:"Resolve the emotional question with a memorable final image."})
]);
const CAMERA=Object.freeze(["measured wide to slow push","handheld close to locked medium","profile track to reveal wide","macro detail to human reaction","low-angle move to eye-level settle","static portrait to pull-back"]);
const EMOTION=Object.freeze(["curiosity becomes recognition","comfort meets tension","uncertainty becomes choice","memory becomes urgency","distance becomes connection","resolution lands as meaning"]);
const AUDIO=Object.freeze(["room tone plus restrained motif","texture-forward foley plus pulse","dialogue space plus low tension bed","breath plus tactile detail","motif returns with lift","music resolves under final natural sound"]);

export function buildMovieBlueprint(input={}){
  const title=clean(input.title), premise=clean(input.premise), audience=clean(input.audience), tone=clean(input.tone);
  if(!title||!premise||!audience||!tone) throw new Error("movie_brief_incomplete");
  const targetMinutes=Math.min(180,Math.max(1,number(input.targetMinutes,8)));
  const sceneCount=Math.max(6,Math.min(12,Math.round(targetMinutes/1.35)));
  const scenes=Array.from({length:sceneCount},(_,index)=>{
    const actIndex=Math.min(2,Math.floor(index/(sceneCount/3)));
    const act=ACTS[actIndex];
    const order=index+1;
    const sceneId="scene-"+String(order).padStart(2,"0");
    return Object.freeze({
      order,
      sceneId,
      actId:act.id,
      continuityId:"continuity-"+String(Math.floor(index/2)+1).padStart(2,"0"),
      storyBeat:index===0?"Open on a visual clue that carries the premise: "+premise:
        index===sceneCount-1?"Close on a transformed image that answers the premise: "+premise:
        act.label+" beat "+order+": advance the premise through visible action, not exposition.",
      cameraIntent:CAMERA[index%CAMERA.length],
      emotionalBeat:EMOTION[index%EMOTION.length],
      audioIntent:AUDIO[index%AUDIO.length],
      proof:Object.freeze({reviewRequired:true,checks:Object.freeze(["story-beat","continuity","camera-intent","emotional-intent"])})
    });
  });
  return Object.freeze({
    schema:"sauceapproved.studio.movie-machine.blueprint",
    version:1,
    title,premise,audience,tone,targetMinutes,
    acts:ACTS,
    scenes:Object.freeze(scenes),
    continuitySpine:Object.freeze(scenes.map(scene=>Object.freeze({sceneId:scene.sceneId,continuityId:scene.continuityId}))),
    emotionCameraGraph:Object.freeze(scenes.map(scene=>Object.freeze({sceneId:scene.sceneId,emotion:scene.emotionalBeat,camera:scene.cameraIntent}))),
    directorsProofMap:Object.freeze(scenes.map(scene=>Object.freeze({sceneId:scene.sceneId,checks:scene.proof.checks,status:"review-required"}))),
    providerStatus:"not-connected",
    renderReady:false
  });
}

export function renderMovieMachine(){
  const manifest=createMovieMachineManifest();
  const cards=[
    ["DIRECTOR'S PROOF MAP","Every scene carries its story purpose, continuity rules, camera intent, emotional intent, and review state in one traceable map."],
    ["EMOTION-TO-CAMERA GRAPH","The emotional arc and camera language move together across the whole film instead of being prompted shot by shot with no memory."],
    ["CONTINUITY SPINE","Wardrobe, props, screen direction, time-of-day, and recurring visual anchors stay attached to the scene graph."]
  ];
  const cardHtml=cards.map((c,i)=>'<article class="card"><span>0'+(i+1)+'</span><h2>'+esc(c[0])+'</h2><p>'+esc(c[1])+'</p></article>').join("");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Movie Machine</title><style>'+
  ':root{font-family:Inter,system-ui,sans-serif;background:#040405;color:#f8f6f2}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 76% 0,#382318 0,#100d0b 34%,#040405 72%)}main{width:min(1180px,100%);margin:auto;padding:clamp(18px,4vw,46px)}a{color:#d8b08a;text-decoration:none}.hero{min-height:470px;display:grid;align-content:end;padding:clamp(28px,6vw,72px);border:1px solid #392a21;border-radius:34px;background:linear-gradient(180deg,#0c0a09bb,#0a0807 70%),radial-gradient(circle at 70% 20%,#6c3a1e55,transparent 42%);box-shadow:0 30px 110px #000c}.eyebrow{font-size:11px;letter-spacing:.23em;color:#cf9a6a}.hero h1{font-size:clamp(52px,10vw,110px);line-height:.84;letter-spacing:-.065em;margin:12px 0 20px}.hero p{max-width:780px;color:#c5bdb5;font-size:clamp(17px,2.2vw,22px);line-height:1.55}.badge{display:inline-flex;margin-top:18px;border:1px solid #66503d;border-radius:999px;padding:9px 12px;color:#e9c69f;font-size:12px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.card{min-height:260px;padding:25px;border:1px solid #2c2825;border-radius:24px;background:#0b0a09}.card span{font-size:11px;letter-spacing:.16em;color:#9d7656}.card h2{font-size:25px;margin:44px 0 12px}.card p{color:#aaa19a;line-height:1.6}.foot{margin-top:18px;padding:18px;border:1px solid #292522;border-radius:18px;color:#9e9690;background:#080706}@media(max-width:820px){.grid{grid-template-columns:1fr}.hero{min-height:420px;border-radius:24px}}'+
  '</style></head><body><main><a href="/">Back to SauceApproved Studio</a><section class="hero"><div class="eyebrow">SAUCEAPPROVED / FLAGSHIP CINEMA SYSTEM</div><h1>Hercules<br>Movie Machine</h1><p>Take one story idea and turn it into a full cinematic production blueprint: acts, scenes, emotional pacing, camera language, continuity, sound direction, and proof before a render provider ever touches the project.</p><div class="badge">Render stays fail-closed until an authorized provider is connected.</div></section><section class="grid">'+cardHtml+'</section><div class="foot">Execution policy: <b>'+esc(manifest.executionPolicy)+'</b> - Competition-gap features are based on reviewed public competitor documentation, not an unsupported universal market-first claim.</div></main></body></html>';
}
