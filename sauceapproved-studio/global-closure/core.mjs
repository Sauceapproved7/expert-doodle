const OWNER="SauceApproved enterprise LLC";
const def=(id,label,requirements)=>Object.freeze({id,label,implementationOwner:OWNER,herculesOwned:true,outsidePlatformAllowed:false,verified:false,requirements:Object.freeze(requirements)});
const validSha=v=>/^[a-f0-9]{64}$/i.test(String(v||""));

export function createGlobalStudioClosureManifest(){
 return Object.freeze({
  schema:"sauceapproved.studio.global-closure/v1",
  implementationOwner:OWNER,
  buildMode:"hercules-owned",
  externalPlatforms:Object.freeze([]),
  thirdPartyHostedRuntimeAllowed:false,
  thirdPartyProductSubstitutionAllowed:false,
  executionPolicy:"inventory-plan-authorize-execute-verify-release",
  systems:Object.freeze([
   def("production-command","Production Command",["schedule-and-milestones","crew-role-map","call-sheet-state","shot-readiness","dependency-blockers","decision-log"]),
   def("identity-access-zones","Identity + Access Zones",["role-scoped-access","least-privilege","session-expiration","sensitive-media-zones","access-audit","revocation-proof"]),
   def("talent-rights-consent","Talent Rights + Consent",["talent-release-state","voice-likeness-consent","territory-use-scope","expiration-restrictions","guardian-approval-boundary","revocation-handling"]),
   def("content-authenticity","Content Authenticity",["capture-origin-record","edit-history-binding","ai-assistance-disclosure","durable-provenance-export","verification-result","no-single-signal-trust"]),
   def("color-mastering","Color + Mastering",["input-color-identity","working-space-policy","display-calibration-state","hdr-sdr-targets","shot-match-proof","mastering-qc"]),
   def("vfx-turnover-conform","VFX Turnover + Conform",["shot-version-identity","handles-and-frame-ranges","plate-and-matte-map","turnover-manifest","return-conform","final-pixel-proof"]),
   def("localization-accessibility","Localization + Accessibility",["caption-master","subtitle-locales","dub-voice-rights","audio-description","transcript","language-qc"]),
   def("live-production-streaming","Live Production + Streaming",["program-preview-state","encoder-health","record-backup","stream-destination-authorization","live-delay-policy","failover-path"]),
   def("network-bandwidth-control","Network + Bandwidth Control",["link-inventory","measured-throughput","latency-jitter-loss","bandwidth-budget","headroom-policy","alternate-path"]),
   def("delivery-packaging-validation","Delivery Packaging + Validation",["platform-target-profile","file-essence-validation","audio-loudness-validation","caption-package-validation","checksum-manifest","delivery-receipt"]),
   def("archive-retention-restore","Archive + Retention + Restore",["archive-class","retention-policy","multi-copy-integrity","encryption-key-custody","restore-drill","deletion-policy"]),
   def("incident-recovery","Incident + Recovery",["incident-severity","production-safe-stop","recovery-capsule","known-good-restore","post-incident-proof","lessons-ledger"]),
   def("operational-observability","Operational Observability",["service-health","device-health","queue-health","render-health","proof-gate-health","alert-routing"]),
   def("capacity-thermal-health","Capacity + Thermal Health",["storage-headroom","compute-headroom","memory-headroom","thermal-state","battery-power-headroom","degradation-policy"]),
   def("production-finance-ledger","Production Finance Ledger",["project-budget","committed-costs","actual-costs","asset-cost-attribution","variance-state","approval-boundary"]),
   def("release-readiness-room","Release Readiness Room",["all-gates-current","owner-approval-boundary","known-blocker-list","proof-receipt-bundle","rollback-plan","release-identity"])
  ]),
  differentiators:Object.freeze(["Release Truth Room","Proof-Spine Gate Mesh","Blind-Spot Release Block","Production-to-Archive Continuity"])
 });
}

export function evaluateGlobalStudioReadiness(manifest,evidence={}){
 if(!manifest?.systems) throw new Error("global_closure_manifest_required");
 const blocked=[],proofReceipts=[];
 for(const s of manifest.systems){
  const e=evidence[s.id];
  const ok=e?.verified===true&&e?.current===true&&validSha(e?.artifactSha256);
  if(!ok) blocked.push(s.id);
  else proofReceipts.push(Object.freeze({systemId:s.id,artifactSha256:String(e.artifactSha256).toLowerCase()}));
 }
 return Object.freeze({
  schema:"sauceapproved.studio.global-readiness/v1",
  releaseReady:blocked.length===0,
  blockedSystemIds:Object.freeze(blocked),
  proofReceipts:Object.freeze(proofReceipts),
  finalAuthority:"owner-controlled-release",
  failClosed:true
 });
}
