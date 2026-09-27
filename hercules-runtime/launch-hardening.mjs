const SHA=/^[a-f0-9]{64}$/i;
export const REQUIRED_LAUNCH_CONTROLS=Object.freeze([
 "security_scan",
 "tenant_isolation",
 "authorization_boundary",
 "idempotency",
 "rate_limits",
 "integrity_tamper",
 "recovery_drill",
 "dependency_failure",
 "observability",
 "backup_restore",
 "performance",
 "deployment_rollback"
]);

export function evaluateLaunchHardening(evidence={}){
 const missing=[],failed=[],invalidEvidence=[];
 for(const control of REQUIRED_LAUNCH_CONTROLS){
  const item=evidence?.[control];
  if(!item){missing.push(control);continue}
  if(item.status!=="VERIFIED")failed.push(control);
  if(!SHA.test(item.evidenceSha256??""))invalidEvidence.push(control);
 }
 const readyForLaunch=!missing.length&&!failed.length&&!invalidEvidence.length;
 return Object.freeze({
  schema:"hercules.launch.hardening.v1",
  disposition:readyForLaunch?"HARDENING_VERIFIED":"NOT_READY",
  readyForLaunch,
  required:[...REQUIRED_LAUNCH_CONTROLS],
  missing:missing.sort(),
  failed:failed.sort(),
  invalidEvidence:invalidEvidence.sort()
 });
}
