import {collectDeployPlaneEvidence} from "./deploy-plane-adapter.mjs";
import {collectGuardianEvidence} from "./collector.mjs";

export function createDeployGuardianBinding({deployment}={}){
 const baseline=collectGuardianEvidence(collectDeployPlaneEvidence(deployment));
 const observe=Object.freeze(async()=>baseline);
 return Object.freeze({id:"deploy",scope:"control-plane",baseline,observe,executionAuthority:false});
}
