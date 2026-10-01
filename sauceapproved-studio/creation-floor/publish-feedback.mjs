export function createPublishPlan({projectId,exportReceiptId,destinations=[]}={}){
 if(!projectId||!exportReceiptId)throw new Error("publish_plan_identity_required");
 return {schema:"hercules.publish-plan/v1",projectId,exportReceiptId,destinations:[...new Set(destinations)].map(id=>({id,authorized:false,connectionId:null})),approval:null,autonomous:false};
}
export function authorizeDestination(plan,{destination,connectionId,verified}={}){
 if(!verified||!destination||!connectionId)throw new Error("verified_destination_connection_required");
 if(!plan.destinations.some(d=>d.id===destination))throw new Error("destination_not_in_plan");
 return {...plan,destinations:plan.destinations.map(d=>d.id===destination?{...d,authorized:true,connectionId}:d)};
}
export function approvePublishPlan(plan,{by}={}){
 if(!by)throw new Error("publish_approval_identity_required");
 return {...plan,approval:{approved:true,by,at:"runtime-assigned"}};
}
export function evaluatePublishPlan(plan){
 const blockers=plan.destinations.filter(d=>!d.authorized).map(d=>`destination_authorization_required:${d.id}`);
 if(!plan.approval?.approved)blockers.push("final_publish_approval_required");
 return {state:blockers.length?"blocked":"ready",blockers};
}
export function ingestPerformanceEvidence({projectId,source,metrics}={}){
 if(!projectId||!source?.id||!source?.verified||!metrics)throw new Error("verified_performance_evidence_required");
 return {schema:"hercules.performance-evidence/v1",projectId,metrics:structuredClone(metrics),proofSpine:{sourceId:source.id,verified:true,observedAt:"runtime-assigned"}};
}
export function buildPerformanceRecommendations(evidence,{brandBrainVersion}={}){
 if(!evidence?.proofSpine?.verified)throw new Error("verified_performance_evidence_required");
 return {schema:"hercules.performance-recommendations/v1",projectId:evidence.projectId,brandBrainVersion,brandMutationAllowed:false,state:"recommendations-only",recommendations:[],evidenceSource:evidence.proofSpine.sourceId};
}
