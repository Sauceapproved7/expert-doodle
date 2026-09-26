const SHA256=/^[a-f0-9]{64}$/i;

function validate(assessment,graph){
 if(!assessment||assessment.schema!=="hercules.recovery.assessment.v1")throw new TypeError("valid recovery assessment is required");
 if(!graph||graph.schema!=="hercules.recovery.graph.v1")throw new TypeError("valid recovery graph is required");
 if(!SHA256.test(assessment.evidenceSha256??""))throw new Error("invalid assessment evidence binding");
 if(!SHA256.test(graph.evidenceSha256??""))throw new Error("invalid graph evidence binding");
}

function output(assessment,graph,route,reasons){
 return Object.freeze({
  schema:"hercules.recovery.route.v1",
  route,
  executionAllowed:false,
  requiresApproval:route!=="NO_ACTION",
  reasonCodes:Object.freeze([...new Set(reasons)]),
  bindings:Object.freeze({assessmentSha256:assessment.evidenceSha256,graphSha256:graph.evidenceSha256}),
  constraints:Object.freeze({
   sendsCommunication:false,
   performsEscalation:false,
   predictsRecovery:false,
   modifiesSourceEvidence:false,
  }),
 });
}

export function planRecoveryRoute({assessment,graph}={}){
 validate(assessment,graph);
 const reasons=[...(assessment.reasonCodes??[])];

 if(!assessment.safeToContact||assessment.state!=="RECOVERY_READY"){
  return output(assessment,graph,assessment.state==="PAID_EVIDENCE"||assessment.state==="NOT_DUE_FOR_RECOVERY"?"NO_ACTION":"HUMAN_REVIEW",reasons);
 }

 if((graph.metrics?.unverifiedEventCount??0)>0){
  return output(assessment,graph,"OWNER_REVIEW_BEFORE_CONTACT",[...reasons,"UNVERIFIED_HISTORY_REQUIRES_REVIEW"]);
 }

 if((graph.metrics?.brokenPromiseCount??0)>0){
  return output(assessment,graph,"OWNER_REVIEW_BEFORE_CONTACT",[...reasons,"VERIFIED_BROKEN_PROMISE_HISTORY"]);
 }

 if((graph.metrics?.openDisputeCount??0)>0){
  return output(assessment,graph,"HUMAN_REVIEW",[...reasons,"OPEN_DISPUTE_HISTORY"]);
 }

 return output(assessment,graph,"OWNER_APPROVED_FOLLOW_UP",[...reasons,"CURRENT_ASSESSMENT_CONTACT_SAFE"]);
}
