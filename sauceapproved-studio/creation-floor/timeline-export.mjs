const n=v=>Number.isFinite(Number(v))?Number(v):0;
const bump=t=>({...t,version:n(t.version)+1});
function locate(timeline,clipId){
 for(let ti=0;ti<(timeline.tracks||[]).length;ti++){const ci=(timeline.tracks[ti].clips||[]).findIndex(c=>c.id===clipId);if(ci>=0)return {ti,ci,clip:timeline.tracks[ti].clips[ci]};}
 throw new Error("clip_not_found");
}
function duration(tracks){return Math.max(0,...tracks.flatMap(t=>(t.clips||[]).map(c=>n(c.startMs)+n(c.durationMs))));}
function withTracks(timeline,tracks){return {...bump(timeline),tracks,durationMs:duration(tracks)};}
export function createTimeline({projectId}={}){if(!projectId)throw new Error("timeline_project_required");return {schema:"hercules.timeline/v1",projectId,version:1,tracks:[],durationMs:0};}
export function addClip(timeline,input={}){
 const {id,assetId,track}=input; const startMs=n(input.startMs),inMs=n(input.inMs),outMs=n(input.outMs);
 if(!id||!assetId||!track)throw new Error("clip_identity_required"); if(outMs<=inMs||startMs<0||inMs<0)throw new Error("invalid_clip_range");
 try{locate(timeline,id);throw new Error("clip_already_exists");}catch(e){if(e.message!=="clip_not_found")throw e;}
 const clip={id,assetId,startMs,durationMs:outMs-inMs,source:{inMs,outMs},nonDestructive:true};
 const existing=(timeline.tracks||[]).find(x=>x.id===track);
 const tracks=existing?(timeline.tracks||[]).map(x=>x.id===track?{...x,clips:[...x.clips,clip]}:x):[...(timeline.tracks||[]),{id:track,clips:[clip]}];
 return withTracks(timeline,tracks);
}
export function moveClip(timeline,{clipId,track,startMs}={}){
 if(n(startMs)<0)throw new Error("invalid_clip_position"); const found=locate(timeline,clipId); const target=track||timeline.tracks[found.ti].id;
 let tracks=timeline.tracks.map((t,i)=>i===found.ti?{...t,clips:t.clips.filter((_,j)=>j!==found.ci)}:{...t,clips:[...t.clips]});
 const moved={...found.clip,startMs:n(startMs)};
 const ix=tracks.findIndex(t=>t.id===target); if(ix>=0)tracks[ix]={...tracks[ix],clips:[...tracks[ix].clips,moved]};else tracks.push({id:target,clips:[moved]});
 tracks=tracks.filter(t=>t.clips.length); return withTracks(timeline,tracks);
}
export function trimClip(timeline,{clipId,inMs,outMs}={}){
 const f=locate(timeline,clipId),a=n(inMs),b=n(outMs); if(a<0||b<=a)throw new Error("invalid_clip_range");
 const tracks=timeline.tracks.map((t,i)=>i===f.ti?{...t,clips:t.clips.map((c,j)=>j===f.ci?{...c,source:{inMs:a,outMs:b},durationMs:b-a,nonDestructive:true}:c)}:t);
 return withTracks(timeline,tracks);
}
export function splitClip(timeline,{clipId,atMs,leftId,rightId}={}){
 const f=locate(timeline,clipId),cut=n(atMs),offset=cut-n(f.clip.startMs); if(!leftId||!rightId||offset<=0||offset>=f.clip.durationMs)throw new Error("invalid_split");
 const sourceCut=n(f.clip.source.inMs)+offset;
 const left={...f.clip,id:leftId,durationMs:offset,source:{inMs:f.clip.source.inMs,outMs:sourceCut}};
 const right={...f.clip,id:rightId,startMs:cut,durationMs:f.clip.durationMs-offset,source:{inMs:sourceCut,outMs:f.clip.source.outMs}};
 const tracks=timeline.tracks.map((t,i)=>i===f.ti?{...t,clips:t.clips.flatMap((c,j)=>j===f.ci?[left,right]:[c])}:t);
 return withTracks(timeline,tracks);
}
export function removeClip(timeline,{clipId}={}){const f=locate(timeline,clipId);return withTracks(timeline,timeline.tracks.map((t,i)=>i===f.ti?{...t,clips:t.clips.filter((_,j)=>j!==f.ci)}:t).filter(t=>t.clips.length));}
export function createExportJob({projectId,timelineVersion,preset,renderer={},approval={}}={}){
 const blockers=[]; if(!renderer.verified)blockers.push("verified_renderer_required"); if(!approval.approved)blockers.push("project_export_approval_required");
 return {schema:"hercules.export-job/v1",projectId,timelineVersion,preset,state:blockers.length?"blocked":"ready",blockers,proofReceipt:{projectId,timelineVersion,preset,rendererId:renderer.id||null,approvedBy:approval.by||null,renderEvidence:"pending-runtime-render"}};
}
