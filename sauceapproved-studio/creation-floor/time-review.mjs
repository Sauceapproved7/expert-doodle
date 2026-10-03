const n=v=>Number.isFinite(Number(v))?Number(v):0;
export function createSnapshot({projectId,projectVersion,label,state}={}){
 if(!projectId||!projectVersion||!label||!state)throw new Error("snapshot_identity_required");
 return {schema:"hercules.project-snapshot/v1",projectId,projectVersion:n(projectVersion),label:String(label),state:structuredClone(state),restoreMode:"copy-forward",createdAt:"runtime-assigned"};
}
export function restoreSnapshot({currentVersion,snapshot}={}){
 if(!snapshot?.projectId||!snapshot?.state)throw new Error("snapshot_required");
 return {projectId:snapshot.projectId,newVersion:n(currentVersion)+1,restoredFromVersion:snapshot.projectVersion,state:structuredClone(snapshot.state),historyRewritten:false};
}
export function createReview({id,projectId,projectVersion,reviewerId}={}){
 if(!id||!projectId||!projectVersion||!reviewerId)throw new Error("review_identity_required");
 return {schema:"hercules.review/v1",id,projectId,projectVersion:n(projectVersion),reviewerId,status:"open",comments:[],decision:null};
}
export function addReviewComment(review,{id,atMs,text}={}){
 if(!id||!String(text||"").trim()||n(atMs)<0)throw new Error("review_comment_required");
 return {...review,comments:[...(review.comments||[]),{id,atMs:n(atMs),text:String(text).trim(),createdAt:"runtime-assigned"}]};
}
export function decideReview(review,{decision,by}={}){
 if(!by)throw new Error("review_decision_identity_required");
 if(!["approved","changes-requested","rejected"].includes(decision))throw new Error("invalid_review_decision");
 return {...review,status:decision,decision:{value:decision,by,at:"runtime-assigned"}};
}
