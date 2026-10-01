import {createCreationFloorManifest} from "./core.mjs";
import {createProjectRecord} from "./project-vault.mjs";
export function createCreationFloorWorkspace({projectId,title,ownerId}={}){
 const manifest=createCreationFloorManifest(),project=createProjectRecord({id:projectId,title,ownerId});
 return {schema:"hercules.creation-floor.workspace/v1",project,flow:manifest.systems.map(s=>s.id),gates:{export:"closed",publish:"closed",externalAnalytics:"closed"},proofSpine:{enabled:true},creativeDnaGuard:{enabled:true,brandMutationAllowed:false}};
}
