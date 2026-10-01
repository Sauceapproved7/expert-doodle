const n=v=>Number.isFinite(Number(v))?Number(v):0;
export function createTimeline({projectId}={}){if(!projectId)throw new Error("timeline_project_required");return {schema:"hercules.timeline/v1",projectId,version:1,tracks:[],durationMs:0};}
export function addClip(timeline,input={}){
 const {id,assetId,track}=input; const startMs=n(input.startMs),inMs=n(input.inMs),outMs=n(input.outMs);
 if(!id||!assetId||!track)throw new Error("clip_identity_required"); if(outMs<=inMs||startMs<0||inMs<0)throw new Error("invalid_clip_range");
 const duration=outMs-inMs,clip={id,assetId,startMs,durationMs:duration,source:{inMs,outMs},nonDestructive:true};
 const existing=(timeline.tracks||[]).find(x=>x.id===track);
 const tracks=existing?(timeline.tracks||[]).map(x=>x.id===track?{...x,clips:[...x.clips,clip]}:x):[...(timeline.tracks||[]),{id:track,clips:[clip]}];
 return {...timeline,version:n(timeline.version)+1,tracks,durationMs:Math.max(n(timeline.durationMs),startMs+duration)};
}
export function createExportJob({projectId,timelineVersion,preset,renderer={},approval={}}={}){
 const blockers=[]; if(!renderer.verified)blockers.push("verified_renderer_required"); if(!approval.approved)blockers.push("project_export_approval_required");
 return {schema:"hercules.export-job/v1",projectId,timelineVersion,preset,state:blockers.length?"blocked":"ready",blockers,proofReceipt:{projectId,timelineVersion,preset,rendererId:renderer.id||null,approvedBy:approval.by||null,renderEvidence:"pending-runtime-render"}};
}
