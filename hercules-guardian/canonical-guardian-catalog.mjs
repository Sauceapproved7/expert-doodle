import {createHerculesGuardianCatalog} from "./hercules-service-catalog.mjs";
import {materializeLiveDeploymentRegistry} from "./live-deployment-registry.mjs";
import {createDeployGuardianBinding} from "./deploy-catalog-binding.mjs";
import {createCleanerReleaseProof} from "./cleaner-release-proof.mjs";
import {createStudioGuardianWatchtowerReader} from "../hercules-video/studio-guardian-watchtower.mjs";

function stateOnly(value,label){
 if(!value||typeof value!=="object")throw new Error(label+" evidence is required");
 const {artifact,config,identity,policy}=value;
 if([artifact,config,identity,policy].some(v=>typeof v!=="string"||!v.trim()))throw new Error(label+" evidence is incomplete");
 return Object.freeze({artifact,config,identity,policy});
}

async function readStudio(reader){
 const cycle=await reader();
 if(cycle?.executionAuthority!==false)throw new Error("Studio evidence must be read-only");
 const result=cycle?.results?.find?.(x=>x?.id==="studio");
 const observed=result?.guardian?.proof?.observed;
 if(!observed)throw new Error("Studio Guardian proof evidence is required");
 return stateOnly(observed,"Studio");
}

async function createStudioBinding(reader){
 const observe=async()=>readStudio(reader);
 const baseline=await observe();
 return Object.freeze({id:"studio",scope:"service",baseline,observe,executionAuthority:false});
}

async function createCleanerBinding(reader){
 if(typeof reader!=="function")throw new Error("Cleaner evidence reader is required");
 const observe=async()=>{
  const current=await reader();
  return stateOnly(createCleanerReleaseProof(current),"Cleaner");
 };
 const baseline=await observe();
 return Object.freeze({id:"cleaner",scope:"device-service",baseline,observe,executionAuthority:false});
}

export async function createCanonicalGuardianCatalog({
 forge,
 runtime,
 deploy,
 cleanerEvidenceReader,
 studioReader=createStudioGuardianWatchtowerReader()
}={}){
 if(typeof studioReader!=="function")throw new Error("Studio evidence reader is required");
 const [studio,live,cleaner]=await Promise.all([
  createStudioBinding(studioReader),
  materializeLiveDeploymentRegistry({forge,runtime}),
  createCleanerBinding(cleanerEvidenceReader)
 ]);
 const deployBinding=createDeployGuardianBinding({deployment:deploy});
 const byId=new Map([studio,...live,deployBinding,cleaner].map(x=>[x.id,x]));
 const ids=["studio","forge","deploy","cleaner","runtime"];
 const baselines=Object.fromEntries(ids.map(id=>[id,byId.get(id)?.baseline]));
 const observers=Object.fromEntries(ids.map(id=>[id,byId.get(id)?.observe]));
 return createHerculesGuardianCatalog({baselines,observers});
}
