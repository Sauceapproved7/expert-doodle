const SHA=/^[a-f0-9]{64}$/i;
export const REQUIRED_PRODUCTION_EVIDENCE=Object.freeze([
  "active_release",
  "health_readiness",
  "structured_logs",
  "alerting",
  "backup_restore",
  "deployment_rollback",
  "production_slo_history"
]);

export function evaluateProductionOpsReadiness(input={}){
 const evidence=input.evidence??{},missing=[],failed=[],invalidEvidence=[],reasonCodes=[];
 for(const key of REQUIRED_PRODUCTION_EVIDENCE){
  const item=evidence[key];
  if(!item){missing.push(key);continue}
  if(item.status!=="VERIFIED")failed.push(key);
  if(!SHA.test(item.evidenceSha256??""))invalidEvidence.push(key);
 }
 if(input.continuousTelemetry!==true)reasonCodes.push("CONTINUOUS_TELEMETRY_REQUIRED");
 if(missing.length)reasonCodes.push("MISSING_PRODUCTION_EVIDENCE");
 if(failed.length)reasonCodes.push("FAILED_PRODUCTION_CONTROL");
 if(invalidEvidence.length)reasonCodes.push("INVALID_PRODUCTION_EVIDENCE");
 const ready=!reasonCodes.length;
 return Object.freeze({
  schema:"hercules.production.ops-readiness.v1",
  ready,
  disposition:ready?"PRODUCTION_OPS_READY":"NOT_READY",
  continuousTelemetry:input.continuousTelemetry===true,
  required:[...REQUIRED_PRODUCTION_EVIDENCE],
  missing:missing.sort(),
  failed:failed.sort(),
  invalidEvidence:invalidEvidence.sort(),
  reasonCodes:[...new Set(reasonCodes)].sort()
 });
}
