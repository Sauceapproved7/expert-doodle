import {createHash} from 'node:crypto';

const SURFACE_LABELS=Object.freeze({
  'movie-machine':'Movie Machine',
  'campaign-forge':'Campaign Forge',
  holostage:'HoloStage',
  'legacy-vault':'Legacy Vault',
  'vintage-camera':'Vintage Camera',
  kids:'Kids Studio',
  'content-multiplier':'Content Multiplier',
  'brand-brain':'Brand Brain',
  'reality-forge':'Reality Forge'
});

function clean(value){return String(value??'').trim();}
function list(value){return Array.isArray(value)?value.map(clean).filter(Boolean):[];}
function canonicalIntent(input={},fallback={}){
  const channelSource=Array.isArray(input.channels)?input.channels:fallback.channels;
  return Object.freeze({
    goal:clean(input.goal||fallback.goal).toLowerCase(),
    audience:clean(input.audience||fallback.audience).toLowerCase(),
    channels:Object.freeze(list(channelSource).map(x=>x.toLowerCase()).sort()),
    childMode:typeof input.childMode==='boolean'?input.childMode:Boolean(fallback.childMode),
    requiresLiveStage:typeof input.requiresLiveStage==='boolean'?input.requiresLiveStage:Boolean(fallback.requiresLiveStage)
  });
}
function fingerprintIntent(intent){return createHash('sha256').update(JSON.stringify(intent)).digest('hex');}
function buildCreativeDnaLedger(input){
  const protectedIntent=canonicalIntent(input);
  return Object.freeze({
    schema:'sauceapproved.studio.director.creative-dna',version:1,algorithm:'sha256',
    protectedDimensions:Object.freeze(['goal','audience','channels','childMode','requiresLiveStage']),
    protectedIntent,fingerprint:fingerprintIntent(protectedIntent),
    driftPolicy:'approval-required-on-protected-change'
  });
}
export function createStudioDirectorManifest(){
  return Object.freeze({
    schema:'sauceapproved.studio.director.manifest',version:1,product:'Hercules Studio Director',
    category:'cross-studio-orchestration',executionPolicy:'route-plan-proof-handoff-fail-closed',
    autonomousMutation:false,autoPublish:false,
    differentiators:Object.freeze(['Cross-Studio Project Router','Showcase Readiness Ledger','Handoff Capsule','Chain-Reaction Rehearsal','Creative DNA Ledger']),
    competitionGapFeatures:Object.freeze(['Chain-Reaction Rehearsal','Creative DNA Ledger']),
    surfaces:Object.freeze(Object.keys(SURFACE_LABELS))
  });
}
function chooseStages(input){
  const goal=clean(input.goal).toLowerCase(); const channels=list(input.channels).map(x=>x.toLowerCase()); const stages=[];
  const add=(id,purpose,gate='review')=>{if(!stages.some(s=>s.surfaceId===id))stages.push({surfaceId:id,label:SURFACE_LABELS[id],purpose,gate});};
  add('brand-brain','Lock brand voice, visual rules, and project constraints before downstream creation.','brand-approval');
  if(input.childMode===true || /kid|child|family[- ]safe/.test(goal)) add('kids','Route child-focused material through the dedicated safety and age-appropriate creation lane.','kids-safety-review');
  if(/legacy|documentary|memory|family history/.test(goal)) add('legacy-vault','Build the source-traceable documentary structure and consent boundaries.','consent-provenance-review');
  if(/movie|film|cinematic|story|trailer/.test(goal)) add('movie-machine','Build acts, scenes, continuity, camera intent, and director proof.','director-proof-review');
  if(input.requiresLiveStage===true || /stage|virtual production|blocking|lighting/.test(goal)) add('holostage','Pre-plan blocking, camera paths, lights, clearances, and continuous moves.','simulation-review');
  if(/transform|rebuild|restyle|relight|era|weather|environment|world|vfx/.test(goal)) add('reality-forge','Rebuild the visual world around approved footage while protecting identity and cross-shot continuity.','reality-proof-review');
  if(/vintage|retro|camera|capture/.test(goal)) add('vintage-camera','Apply the owned capture/look pipeline for vintage visual language.','capture-review');
  if(/campaign|ad|commercial|launch|promo|marketing/.test(goal) || channels.length) add('campaign-forge','Translate the approved creative into campaign-ready deliverables.','campaign-review');
  if(channels.length>1 || /repurpose|multichannel|multi-channel|content/.test(goal)) add('content-multiplier','Adapt the approved master into channel-specific derivatives.','channel-review');
  if(stages.length===1) add('movie-machine','Create a structured master story and shot plan for the brief.','director-proof-review');
  return stages;
}
export function rehearseStudioChain(plan,scenario={}){
  if(!plan||!Array.isArray(plan.stages)||!Array.isArray(plan.proofLedger))throw new Error('studio_director_plan_required');
  const failedGates=new Set(list(scenario.failedGates)); const unavailableSurfaces=new Set(list(scenario.unavailableSurfaces));
  const existingBlockers=new Map((plan.blockers||[]).map(item=>[item.surfaceId,item.code])); let upstreamBlocked=false; let firstFailure=null;
  const stages=plan.stages.map(stage=>{
    let outcome='would-reach-gate'; let reason='proof-required-before-execution';
    if(upstreamBlocked){outcome='blocked-by-upstream';reason='upstream-stage-did-not-clear';}
    else if(unavailableSurfaces.has(stage.surfaceId)){outcome='blocked-at-surface';reason='surface-unavailable-in-rehearsal';upstreamBlocked=true;}
    else if(existingBlockers.has(stage.surfaceId)){outcome='blocked-at-gate';reason=existingBlockers.get(stage.surfaceId);upstreamBlocked=true;}
    else if(failedGates.has(stage.gate)){outcome='blocked-at-gate';reason='simulated-gate-failure:'+stage.gate;upstreamBlocked=true;}
    if(!firstFailure&&outcome.startsWith('blocked-at')) firstFailure=stage.surfaceId;
    return Object.freeze({stageId:stage.stageId,surfaceId:stage.surfaceId,gate:stage.gate,outcome,reason,executionAttempted:false});
  });
  const firstFailureIndex=firstFailure?stages.findIndex(stage=>stage.surfaceId===firstFailure):-1;
  const blastRadius=firstFailureIndex<0?[]:stages.slice(firstFailureIndex+1).map(stage=>stage.surfaceId);
  return Object.freeze({schema:'sauceapproved.studio.director.chain-reaction-rehearsal',version:1,scenario:Object.freeze({failedGates:Object.freeze([...failedGates]),unavailableSurfaces:Object.freeze([...unavailableSurfaces])}),stages:Object.freeze(stages),firstFailure,blastRadius:Object.freeze(blastRadius),executionAttempted:false,publishAttempted:false,safeToRunLive:firstFailure===null && (plan.blockers||[]).length===0});
}
export function evaluateCreativeDrift(plan,candidate={}){
  const ledger=plan?.creativeDnaLedger; if(!ledger?.protectedIntent||!ledger?.fingerprint)throw new Error('creative_dna_ledger_required');
  const baseline=ledger.protectedIntent; const current=canonicalIntent(candidate,baseline);
  const changedDimensions=ledger.protectedDimensions.filter(key=>JSON.stringify(current[key])!==JSON.stringify(baseline[key]));
  return Object.freeze({schema:'sauceapproved.studio.director.creative-drift-report',version:1,baselineFingerprint:ledger.fingerprint,candidateFingerprint:fingerprintIntent(current),changedDimensions:Object.freeze(changedDimensions),driftDetected:changedDimensions.length>0,requiresApproval:changedDimensions.length>0,protectedIntent:current});
}
export function buildStudioProductionPlan(input={}){
  const title=clean(input.title); const goal=clean(input.goal); const audience=clean(input.audience);
  if(!title||!goal||!audience)throw new Error('studio_director_brief_incomplete');
  const approvedSourceCount=Math.max(0,Number.isFinite(Number(input.approvedSourceCount))?Math.trunc(Number(input.approvedSourceCount)):0);
  const stages=chooseStages(input).map((stage,index)=>Object.freeze({order:index+1,stageId:'stage-'+String(index+1).padStart(2,'0'),...stage,dependsOn:index===0?Object.freeze([]):Object.freeze(['stage-'+String(index).padStart(2,'0')]),status:'planned'}));
  const needsLegacy=stages.some(stage=>stage.surfaceId==='legacy-vault'); const blockers=[];
  if(needsLegacy&&approvedSourceCount<1) blockers.push(Object.freeze({code:'approved_source_required',surfaceId:'legacy-vault',ownerAction:true}));
  if(input.requiresLiveStage===true) blockers.push(Object.freeze({code:'live_stage_bridge_not_authorized',surfaceId:'holostage',ownerAction:true}));
  const proofLedger=stages.map(stage=>Object.freeze({stageId:stage.stageId,surfaceId:stage.surfaceId,gate:stage.gate,proofStatus:'required',mayExecute:false}));
  const handoffCapsule=Object.freeze({projectTitle:title,route:Object.freeze(stages.map(stage=>stage.surfaceId)),requiredApprovals:Object.freeze([...new Set(stages.map(stage=>stage.gate))]),blockers:Object.freeze(blockers.map(item=>item.code)),readyForAutonomousExecution:false,readyForPublicPublish:false});
  const creativeDnaLedger=buildCreativeDnaLedger({goal,audience,channels:list(input.channels),childMode:input.childMode===true,requiresLiveStage:input.requiresLiveStage===true});
  const basePlan={schema:'sauceapproved.studio.director.production-plan',version:1,title,goal,audience,channels:Object.freeze(list(input.channels)),stages:Object.freeze(stages),proofLedger:Object.freeze(proofLedger),blockers:Object.freeze(blockers),handoffCapsule,creativeDnaLedger,planReady:blockers.length===0,executionReady:false,publishReady:false};
  return Object.freeze({...basePlan,chainReactionRehearsal:rehearseStudioChain(basePlan)});
}
export function renderStudioDirector(){
  const cards=[
    ['CROSS-STUDIO PROJECT ROUTER','One brief becomes the right sequence of Hercules Studio systems instead of forcing the operator to guess which tool comes next.'],
    ['SHOWCASE READINESS LEDGER','Every stage carries a visible proof gate and blocked/ready state before anything can cross into execution.'],
    ['HANDOFF CAPSULE','The final route, approvals, blockers, and deliverable path travel together so work can move across Studio pieces without losing context.'],
    ['CHAIN-REACTION REHEARSAL','Simulate a broken approval, missing source, unavailable surface, or safety gate and see the exact downstream blast radius before any Studio system executes.'],
    ['CREATIVE DNA LEDGER','Fingerprint the approved creative intent and require review when a handoff changes protected direction such as audience, goal, channel plan, child-safety mode, or live-stage intent.']
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Studio Director</title><style>:root{font-family:Inter,system-ui,sans-serif;background:#050407;color:#f7f4ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 12% 0,#391a52 0,#120817 34%,#050407 72%)}main{width:min(1180px,100%);margin:auto;padding:clamp(18px,4vw,46px)}a{color:#d9adff;text-decoration:none}.hero{min-height:490px;display:grid;align-content:end;padding:clamp(28px,6vw,72px);border:1px solid #533164;border-radius:34px;background:linear-gradient(160deg,#24102f,#09060d 72%);box-shadow:0 30px 110px #000c}.eyebrow{font-size:11px;letter-spacing:.23em;color:#d29cf5}.hero h1{font-size:clamp(52px,10vw,108px);line-height:.84;letter-spacing:-.065em;margin:12px 0 20px}.hero p{max-width:830px;color:#cdbed6;font-size:clamp(17px,2.2vw,22px);line-height:1.55}.badge{display:inline-flex;margin-top:18px;border:1px solid #754a87;border-radius:999px;padding:9px 12px;color:#e6c8ff;font-size:12px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.card{min-height:270px;padding:25px;border:1px solid #34213e;border-radius:24px;background:#0e0912}.card span{font-size:11px;letter-spacing:.16em;color:#a372b7}.card h2{font-size:25px;margin:44px 0 12px}.card p{color:#ae9db7;line-height:1.6}.foot{margin-top:18px;padding:18px;border:1px solid #34213e;border-radius:18px;color:#97879f;background:#0a070d}@media(max-width:820px){.grid{grid-template-columns:1fr}.hero{min-height:420px;border-radius:24px}}</style></head><body><main><a href="/">Back to SauceApproved Studio</a><section class="hero"><div class="eyebrow">SAUCEAPPROVED / STUDIO CONTROL TOWER</div><h1>Hercules<br>Studio Director</h1><p>Give the Studio one job. Director chooses the right Hercules surfaces, orders the handoffs, tracks proof gates, and keeps every execution or publishing boundary closed until it is actually authorized.</p><div class="badge">Plans across the Studio. Does not silently execute or publish.</div></section><section class="grid">${cards.map((c,i)=>`<article class="card"><span>0${i+1}</span><h2>${c[0]}</h2><p>${c[1]}</p></article>`).join('')}</section><div class="foot">Execution policy: <b>route-plan-proof-handoff-fail-closed</b></div></main></body></html>`;
}
