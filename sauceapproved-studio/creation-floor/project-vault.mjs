const RIGHTS_READY=new Set(["owned","licensed","cleared","public-domain"]);
function required(value,code){if(!String(value||"").trim())throw new Error(code);return String(value).trim();}
export function createProjectRecord({id,title,ownerId}={}){
 return {schema:"hercules.project/v1",id:required(id,"project_identity_required"),title:required(title,"project_identity_required"),ownerId:required(ownerId,"project_identity_required"),state:"active",version:1,assetIds:[],createdAt:"runtime-assigned",updatedAt:"runtime-assigned"};
}
export function updateProjectState(project,state){
 if(!project?.id)throw new Error("project_identity_required");
 if(!["active","archived"].includes(state))throw new Error("invalid_project_state");
 return {...project,state,version:Number(project.version||0)+1,updatedAt:"runtime-assigned"};
}
export function duplicateProject(project,{id,title}={}){
 if(!project?.id||!project?.ownerId)throw new Error("project_identity_required");
 return {...createProjectRecord({id,title:title||project.title,ownerId:project.ownerId}),duplicatedFrom:project.id};
}
export function attachVaultAsset(project,input={}){
 if(!project?.id)throw new Error("project_identity_required");
 if(!input?.provenance?.source||!input?.rights?.status)throw new Error("asset_provenance_and_rights_required");
 if(!RIGHTS_READY.has(input.rights.status)&&input.rights.status!=="pending")throw new Error("unsupported_asset_rights");
 const id=required(input.id,"asset_identity_required"),name=required(input.name,"asset_identity_required"),kind=required(input.kind,"asset_identity_required");
 if(project.assetIds?.includes(id))throw new Error("asset_already_attached");
 const asset={schema:"hercules.media-vault.asset/v1",id,projectId:project.id,name,kind,tags:[...(input.tags||[])],provenance:{...input.provenance},rights:{...input.rights},proofSpine:{source:input.provenance.source,rightsStatus:input.rights.status,verified:false}};
 return {project:{...project,version:Number(project.version||0)+1,assetIds:[...(project.assetIds||[]),id],updatedAt:"runtime-assigned"},asset};
}
export function searchVaultAssets(assets,{projectId,query="",kind=null,rightsReady=false}={}){
 const q=String(query).trim().toLowerCase();
 return (assets||[]).filter(a=>a.projectId===projectId)
  .filter(a=>!q||String(a.name||"").toLowerCase().includes(q)||(a.tags||[]).some(t=>String(t).toLowerCase().includes(q)))
  .filter(a=>!kind||a.kind===kind)
  .filter(a=>!rightsReady||RIGHTS_READY.has(a?.rights?.status));
}
