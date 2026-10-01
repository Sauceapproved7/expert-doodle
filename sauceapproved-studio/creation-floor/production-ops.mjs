const OWNER="SauceApproved enterprise LLC";
const RIGHTS_USABLE=new Set(["owned","licensed","cleared","public-domain"]);

const system=(id,label,kind)=>Object.freeze({
  id,label,kind,
  implementationOwner:OWNER,
  herculesOwned:true,
  outsidePlatformAllowed:false,
  verified:false
});

function required(value,code){
  if(!String(value||"").trim()) throw new Error(code);
  return String(value).trim();
}

function validSha256(value){
  return /^[a-f0-9]{64}$/i.test(String(value||""));
}

export function createCreationFloorExpansionManifest(){
  return Object.freeze({
    schema:"sauceapproved.creation-floor.expansion/v1",
    implementationOwner:OWNER,
    buildMode:"hercules-owned",
    externalPlatforms:Object.freeze([]),
    thirdPartyHostedRuntimeAllowed:false,
    thirdPartyProductSubstitutionAllowed:false,
    systems:Object.freeze([
      system("dailies-live-ingest","Dailies + Live Ingest","software-runtime"),
      system("proxy-offline-media","Proxy + Offline Media","software-runtime"),
      system("delivery-qc","Delivery QC","software-runtime"),
      system("asset-dependency-relink","Asset Dependency + Relink Health","software-runtime"),
      system("rights-release-expiration","Rights + Release Expiration","software-runtime"),
      system("physical-shoot-continuity","Physical Shoot Continuity","cross-division")
    ])
  });
}

export function createIngestSession({id,projectId,sourceId}={}){
  return {
    schema:"sauceapproved.creation-floor.ingest/v1",
    id:required(id,"ingest_identity_required"),
    projectId:required(projectId,"ingest_project_required"),
    sourceId:required(sourceId,"ingest_source_required"),
    state:"open",
    takes:[],
    fingerprints:[],
    originalMediaPreserved:true,
    proofSpine:{enabled:true}
  };
}

export function registerIngestTake(session,{takeId,assetId,sha256,bytes,observedAt="runtime-assigned"}={}){
  if(session?.state!=="open") throw new Error("ingest_session_not_open");
  const digest=required(sha256,"ingest_fingerprint_required").toLowerCase();
  if(!validSha256(digest)) throw new Error("invalid_ingest_fingerprint");
  if((session.fingerprints||[]).includes(digest)) throw new Error("duplicate_ingest_fingerprint");
  const size=Number(bytes);
  if(!Number.isFinite(size)||size<=0) throw new Error("invalid_ingest_size");
  const take={
    takeId:required(takeId,"ingest_take_identity_required"),
    assetId:required(assetId,"ingest_asset_identity_required"),
    sourceId:session.sourceId,
    sha256:digest,
    bytes:size,
    observedAt,
    immutableOriginal:true
  };
  return {
    ...session,
    takes:[...(session.takes||[]),take],
    fingerprints:[...(session.fingerprints||[]),digest]
  };
}

export function finalizeIngestSession(session){
  if(!session?.id) throw new Error("ingest_session_required");
  const blockers=[];
  if(!(session.takes||[]).length) blockers.push("ingest_take_required");
  if(new Set(session.fingerprints||[]).size!==(session.fingerprints||[]).length) blockers.push("duplicate_ingest_fingerprint");
  return {
    ...session,
    state:blockers.length?"blocked":"sealed",
    blockers,
    sealedTakeCount:(session.takes||[]).length
  };
}

export function buildProxyPlan({assetId,sourceSha256,target={}}={}){
  const source=required(sourceSha256,"proxy_source_fingerprint_required").toLowerCase();
  if(!validSha256(source)) throw new Error("invalid_proxy_source_fingerprint");
  const width=Number(target.width),height=Number(target.height),bitrateKbps=Number(target.bitrateKbps);
  if(!required(assetId,"proxy_asset_required")||width<=0||height<=0||bitrateKbps<=0) throw new Error("invalid_proxy_target");
  return Object.freeze({
    schema:"sauceapproved.creation-floor.proxy-plan/v1",
    assetId,
    sourceSha256:source,
    target:Object.freeze({width,height,bitrateKbps}),
    originalPreserved:true,
    proxyIsDerivative:true,
    relinkByFingerprint:true,
    state:"planned",
    generatedProxySha256:null
  });
}

export function buildDeliveryQcReport({deliverableId,video={},audio={},captions={},proof={}}={}){
  const blockers=[];
  if(!deliverableId) blockers.push("deliverable_identity_required");
  if(!(Number(video.width)>0&&Number(video.height)>0&&Number(video.fps)>0&&Number(video.durationMs)>0)) blockers.push("video_metadata_invalid");
  if(!(Number(audio.channels)>0&&Number(audio.sampleRateHz)>=44100&&Number.isFinite(Number(audio.peakDbfs)))) blockers.push("audio_metadata_invalid");
  if(captions.required===true&&captions.present!==true) blockers.push("captions_required");
  if(proof.verified!==true) blockers.push("proof_receipt_unverified");
  return Object.freeze({
    schema:"sauceapproved.creation-floor.delivery-qc/v1",
    deliverableId:deliverableId||null,
    ready:blockers.length===0,
    blockers:Object.freeze(blockers),
    checks:Object.freeze({
      videoMetadata:blockers.includes("video_metadata_invalid")?"blocked":"pass",
      audioMetadata:blockers.includes("audio_metadata_invalid")?"blocked":"pass",
      captions:blockers.includes("captions_required")?"blocked":"pass",
      proof:blockers.includes("proof_receipt_unverified")?"blocked":"pass"
    })
  });
}

export function buildAssetDependencyGraph({projectId,assets=[],references=[]}={}){
  required(projectId,"dependency_project_required");
  const nodes=Object.fromEntries((assets||[]).map(asset=>[
    required(asset.id,"dependency_asset_identity_required"),
    {
      id:String(asset.id),
      sha256:validSha256(asset.sha256)?String(asset.sha256).toLowerCase():null,
      location:asset.location?String(asset.location):null
    }
  ]));
  const edges=(references||[]).map(ref=>({
    consumerId:required(ref.consumerId,"dependency_consumer_required"),
    assetId:required(ref.assetId,"dependency_asset_reference_required")
  }));
  return Object.freeze({
    schema:"sauceapproved.creation-floor.dependency-graph/v1",
    projectId,
    assets:Object.freeze(nodes),
    references:Object.freeze(edges)
  });
}

export function evaluateRelinkHealth(graph){
  if(!graph?.projectId) throw new Error("dependency_graph_required");
  const assetIds=new Set(Object.keys(graph.assets||{}));
  const missing=[...new Set((graph.references||[]).filter(ref=>!assetIds.has(ref.assetId)).map(ref=>ref.assetId))].sort();
  const unverifiable=Object.values(graph.assets||{}).filter(asset=>!asset.sha256||!asset.location).map(asset=>asset.id).sort();
  return Object.freeze({
    schema:"sauceapproved.creation-floor.relink-health/v1",
    projectId:graph.projectId,
    healthy:missing.length===0&&unverifiable.length===0,
    missingAssetIds:Object.freeze(missing),
    unverifiableAssetIds:Object.freeze(unverifiable)
  });
}

export function registerRightsRelease({id,assetId,status,expiresAt=null,releaseId=null,territories=["world"],uses=["studio"]}={}){
  const normalized=required(status,"rights_status_required");
  if(!RIGHTS_USABLE.has(normalized)&&normalized!=="pending"&&normalized!=="restricted") throw new Error("unsupported_rights_status");
  if(expiresAt!==null&&!Number.isFinite(Date.parse(expiresAt))) throw new Error("invalid_rights_expiration");
  return Object.freeze({
    schema:"sauceapproved.creation-floor.rights-release/v1",
    id:required(id,"rights_record_identity_required"),
    assetId:required(assetId,"rights_asset_required"),
    status:normalized,
    expiresAt,
    releaseId:releaseId?String(releaseId):null,
    territories:Object.freeze([...territories].map(String)),
    uses:Object.freeze([...uses].map(String))
  });
}

export function evaluateRightsStatus(record,{asOf}={}){
  if(!record?.id) throw new Error("rights_record_required");
  const timestamp=Date.parse(required(asOf,"rights_evaluation_time_required"));
  if(!Number.isFinite(timestamp)) throw new Error("invalid_rights_evaluation_time");
  const expired=record.expiresAt!==null&&timestamp>=Date.parse(record.expiresAt);
  const blockers=[];
  if(!RIGHTS_USABLE.has(record.status)) blockers.push("rights_not_cleared");
  if(expired) blockers.push("rights_expired");
  return Object.freeze({
    usable:blockers.length===0,
    expired,
    blockers:Object.freeze(blockers)
  });
}

export function bindShootContinuity({projectId,timelineVersion,shotId,goldenTake}={}){
  const blockers=[];
  if(!projectId||!shotId||!(Number(timelineVersion)>0)) blockers.push("editorial_identity_required");
  if(!goldenTake?.takeId||!validSha256(goldenTake?.fingerprint)||goldenTake?.verified!==true) blockers.push("verified_golden_take_required");
  return Object.freeze({
    schema:"sauceapproved.creation-floor.shoot-continuity/v1",
    projectId:projectId||null,
    timelineVersion:Number(timelineVersion)||0,
    shotId:shotId||null,
    goldenTakeId:goldenTake?.takeId||null,
    goldenTakeFingerprint:goldenTake?.fingerprint||null,
    ready:blockers.length===0,
    blockers:Object.freeze(blockers),
    restoreAuthority:"memory-grid-verified-state-only"
  });
}
