const num=v=>Number.isFinite(Number(v))?Number(v):0;
export function createTranscript({projectId,assetId,language="en",source}={}){
 if(!projectId||!assetId||!source)throw new Error("transcript_identity_and_provenance_required");
 return {schema:"hercules.transcript/v1",projectId,assetId,language,version:1,cues:[],provenance:{source},editable:true};
}
export function addCaptionCue(transcript,{id,startMs,endMs,text}={}){
 const start=num(startMs),end=num(endMs); if(!id||!String(text||"").trim())throw new Error("caption_identity_required");
 if(start<0||end<=start)throw new Error("invalid_caption_timing");
 return {...transcript,version:num(transcript.version)+1,cues:[...(transcript.cues||[]),{id,startMs:start,endMs:end,durationMs:end-start,text:String(text).trim(),editable:true}]};
}
export function createAudioSession({projectId}={}){
 if(!projectId)throw new Error("audio_project_required");
 return {schema:"hercules.audio-workbench/v1",projectId,version:1,layers:[],master:{targetLufs:null,limiter:false}};
}
export function addAudioLayer(session,{id,assetId,kind,rights,gainDb=0,startMs=0}={}){
 if(!id||!assetId||!kind||!rights?.status)throw new Error("audio_layer_identity_and_rights_required");
 const layer={id,assetId,kind,rights:{...rights},gainDb:num(gainDb),startMs:num(startMs),nonDestructive:true};
 return {...session,version:num(session.version)+1,layers:[...(session.layers||[]),layer]};
}
export function buildMixPlan(session){
 const blockers=(session.layers||[]).filter(l=>!["owned","licensed","cleared","public-domain"].includes(l.rights?.status)).map(l=>`audio_rights_clearance_required:${l.id}`);
 return {schema:"hercules.audio-mix-plan/v1",projectId:session.projectId,sessionVersion:session.version,state:blockers.length?"blocked":"ready",blockers,layers:(session.layers||[]).map(l=>({id:l.id,kind:l.kind,gainDb:l.gainDb,startMs:l.startMs})),renderEvidence:"pending-runtime-render"};
}
