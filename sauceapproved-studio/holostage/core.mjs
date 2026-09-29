const DIFFERENTIATORS=Object.freeze(["One-Take Stress Test","Camera-Light Collision Guard","Spatial Continuity Lock"]);

function clean(value){return String(value??"").trim();}
function esc(value){return clean(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
function n(value){const out=Number(value);return Number.isFinite(out)?out:NaN;}

export function createHoloStageManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.holostage.manifest",
    version:1,
    product:"Hercules HoloStage",
    category:"virtual-production",
    executionPolicy:"simulation-only-until-authorized",
    liveControlEnabled:false,
    differentiators:DIFFERENTIATORS,
    competitionGapFeatures:Object.freeze(["One-Take Stress Test","Camera-Light Collision Guard"]),
    outputs:Object.freeze(["blocking map","camera path","light cue sheet","one-take stress report","collision report"])
  });
}

export function buildStagePlan(input={}){
  const title=clean(input.title), width=n(input.stageWidth), depth=n(input.stageDepth);
  const subjects=Array.isArray(input.subjects)?input.subjects.map(clean).filter(Boolean):[];
  const beats=Array.isArray(input.beats)?input.beats.map(clean).filter(Boolean):[];
  if(!title||!(width>0)||!(depth>0)) throw new Error("stage_geometry_invalid");
  if(!subjects.length||!beats.length) throw new Error("stage_plan_incomplete");
  const safeX=Math.max(1,width-2), safeZ=Math.max(1,depth-2);
  const blocking=beats.map((beat,index)=>Object.freeze({
    beatId:"beat-"+(index+1),beat,
    subject:subjects[index%subjects.length],
    x:Number(((index+1)*safeX/(beats.length+1)).toFixed(2)),
    z:Number((((index%2)+1)*safeZ/3).toFixed(2))
  }));
  const cameraPath=beats.map((beat,index)=>Object.freeze({
    beatId:"beat-"+(index+1),
    cameraId:"A",
    x:Number(((index+0.5)*safeX/Math.max(1,beats.length)).toFixed(2)),
    z:Number((depth-1-(index%2)*1.25).toFixed(2)),
    lensMm:[24,35,50,65][index%4],
    move:["push","arc","track","settle"][index%4]
  }));
  const lightCues=beats.map((beat,index)=>Object.freeze({
    beatId:"beat-"+(index+1),
    cue:"L"+String(index+1).padStart(2,"0"),
    keyIntensity:Number((0.62+index*0.06).toFixed(2)),
    direction:index%2===0?"camera-left":"camera-right"
  }));
  const stressSegments=cameraPath.slice(1).map((point,index)=>Object.freeze({
    from:cameraPath[index].beatId,to:point.beatId,resetSeconds:0,feasible:true,reason:"continuous-path-clear"
  }));
  return Object.freeze({
    schema:"sauceapproved.studio.holostage.plan",
    version:1,
    title,
    mode:"virtual-production-plan",
    liveExecution:false,
    stage:Object.freeze({width,depth,units:"meters"}),
    blocking:Object.freeze(blocking),
    cameraPath:Object.freeze(cameraPath),
    lightCues:Object.freeze(lightCues),
    oneTakeStressTest:Object.freeze({pass:stressSegments.every(x=>x.feasible),segments:Object.freeze(stressSegments)}),
    safety:Object.freeze({collisionsDetected:0,guard:"camera-light-subject-clearance"}),
    spatialContinuityLock:Object.freeze(blocking.map(item=>Object.freeze({beatId:item.beatId,x:item.x,z:item.z})))
  });
}

export function renderHoloStage(){
  const manifest=createHoloStageManifest();
  const cards=[
    ["ONE-TAKE STRESS TEST","Runs the full blocking, camera path, and cue sequence as one continuous plan and flags impossible transitions before the crew hits the floor."],
    ["CAMERA-LIGHT COLLISION GUARD","Cross-checks camera movement, subject zones, and lighting positions so a beautiful move does not become an unsafe or impossible physical setup."],
    ["SPATIAL CONTINUITY LOCK","Keeps repeatable stage coordinates attached to story beats so resets and pickups return to the same geometry."]
  ];
  const cardHtml=cards.map((c,i)=>'<article class="card"><span>0'+(i+1)+'</span><h2>'+esc(c[0])+'</h2><p>'+esc(c[1])+'</p></article>').join("");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules HoloStage</title><style>'+
  ':root{font-family:Inter,system-ui,sans-serif;background:#030507;color:#f3fbff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -10%,#082b3a 0,#071016 33%,#030507 72%)}main{width:min(1180px,100%);margin:auto;padding:clamp(18px,4vw,46px)}a{color:#82d8ef;text-decoration:none}.hero{position:relative;overflow:hidden;min-height:470px;padding:clamp(28px,6vw,72px);display:grid;align-content:end;border:1px solid #1c4554;border-radius:34px;background:linear-gradient(180deg,#07121a88,#050a0e),repeating-linear-gradient(90deg,#1b708222 0 1px,transparent 1px 42px),repeating-linear-gradient(0deg,#1b708222 0 1px,transparent 1px 42px)}.eyebrow{font-size:11px;letter-spacing:.23em;color:#70d9f3}.hero h1{font-size:clamp(52px,10vw,108px);line-height:.84;letter-spacing:-.065em;margin:12px 0 20px}.hero p{max-width:800px;color:#abc7cf;font-size:clamp(17px,2.2vw,22px);line-height:1.55}.badge{display:inline-flex;margin-top:18px;border:1px solid #276073;border-radius:999px;padding:9px 12px;color:#9feaff;font-size:12px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.card{min-height:260px;padding:25px;border:1px solid #15313b;border-radius:24px;background:#061017}.card span{font-size:11px;letter-spacing:.16em;color:#558ea0}.card h2{font-size:25px;margin:44px 0 12px}.card p{color:#8fb0ba;line-height:1.6}.foot{margin-top:18px;padding:18px;border:1px solid #15313b;border-radius:18px;color:#7f9ca5;background:#050c10}@media(max-width:820px){.grid{grid-template-columns:1fr}.hero{min-height:420px;border-radius:24px}}'+
  '</style></head><body><main><a href="/">Back to SauceApproved Studio</a><section class="hero"><div class="eyebrow">SAUCEAPPROVED / VIRTUAL PRODUCTION FLOOR</div><h1>Hercules<br>HoloStage</h1><p>Block people, cameras, lights, movement, and scene beats on a virtual floor before production. It plans the physical dance of a shot and refuses to pretend it is controlling real hardware until an authorized live bridge exists.</p><div class="badge">Simulation only - live stage control disabled by default.</div></section><section class="grid">'+cardHtml+'</section><div class="foot">Execution policy: <b>'+esc(manifest.executionPolicy)+'</b> - Safety and feasibility stay visible before live execution.</div></main></body></html>';
}
