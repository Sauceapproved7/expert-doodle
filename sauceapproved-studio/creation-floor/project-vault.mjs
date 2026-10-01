function required(value,code){if(!String(value||"").trim())throw new Error(code);return String(value).trim();}
export function createProjectRecord({id,title,ownerId}={}){
 return {schema:"hercules.project/v1",id:required(id,"project_identity_required"),title:required(title,"project_identity_required"),ownerId:required(ownerId,"project_identity_required"),state:"active",version:1,assetIds:[],createdAt:"runtime-assigned",updatedAt:"runtime-assigned"};
}
export function attachVaultAsset(project,input={}){
 if(!project?.id)throw new Error("project_identity_required");
 if(!input?.provenance?.source||!input?.rights?.status)throw new Error("asset_provenance_and_rights_required");
 const id=required(input.id,"asset_identity_required"),name=required(input.name,"asset_identity_required"),kind=required(input.kind,"asset_identity_required");
 if(project.assetIds?.includes(id))throw new Error("asset_already_attached");
 const asset={schema:"hercules.media-vault.asset/v1",id,projectId:project.id,name,kind,tags:[...(input.tags||[])],provenance:{...input.provenance},rights:{...input.rights},proofSpine:{source:input.provenance.source,rightsStatus:input.rights.status,verified:false}};
 return {project:{...project,version:Number(project.version||0)+1,assetIds:[...(project.assetIds||[]),id],updatedAt:"runtime-assigned"},asset};
}
export function searchVaultAssets(assets,{projectId,query=""}={}){
 const q=String(query).trim().toLowerCase();
 return (assets||[]).filter(a=>a.projectId===projectId).filter(a=>!q||String(a.name||"").toLowerCase().includes(q)||(a.tags||[]).some(t=>String(t).toLowerCase().includes(q)));
}
