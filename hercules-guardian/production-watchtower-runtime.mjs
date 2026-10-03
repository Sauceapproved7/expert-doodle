import {createHash} from "node:crypto";
import {createStudioGuardianWatchtowerReader} from "../hercules-video/studio-guardian-watchtower.mjs";
import {createWatchtowerRegistry} from "./watchtower-registry.mjs";
import {createCanonicalWatchtowerRuntime} from "./canonical-watchtower-runtime.mjs";

const FORGE_URL="https://sauceapproved-forge-control.onrender.com/health";
const BROWSER_URL="https://hercules-browser-standalone.onrender.com/health";
const DEPLOY_URL="https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-deploy-controller";
const CLEANER_COMMIT="77093aceae5d5df5a3ae4d3947b607473ff15db9";

function stable(value){
 if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";
 if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stable(value[k])).join(",")+"}";
 return JSON.stringify(value);
}
function digest(value){return "sha256:"+createHash("sha256").update(stable(value)).digest("hex")}
function normalizedState(value,label){
 if(!value||typeof value!=="object")throw new Error(label+" evidence is required");
 const out={artifact:value.artifact,config:value.config,identity:value.identity,policy:value.policy};
 if(Object.values(out).some(v=>typeof v!=="string"||!v.trim()))throw new Error(label+" evidence is incomplete");
 return Object.freeze(out);
}
async function fetchJson(url,fetchImpl){
 const response=await fetchImpl(url,{method:"GET",headers:{"accept":"application/json","cache-control":"no-cache"},signal:AbortSignal.timeout(5000)});
 if(!response?.ok)throw new Error("Guardian evidence request failed: "+url+" status "+String(response?.status??"unknown"));
 const body=await response.json();
 if(!body||typeof body!=="object")throw new Error("Guardian evidence response invalid: "+url);
 return body;
}

const FORGE_BASELINE=Object.freeze({
 artifact:digest({service:"hercules-forge-control-api",version:"1.6"}),
 config:digest({mode:"production",publicOrigin:"https://sauceapproved-forge-control.onrender.com"}),
 identity:"http:hercules-forge-control-api",
 policy:"guardian-forge-health-v1"
});
const BROWSER_BASELINE=Object.freeze({
 artifact:digest({service:"hercules-browser-standalone",version:"1.0.0"}),
 config:digest({engine:"playwright-local-chromium",rawCodeExecution:false,antiBotBypass:false}),
 identity:"http:hercules-browser-standalone",
 policy:"guardian-browser-health-v1"
});
const DEPLOY_BASELINE=Object.freeze({
 artifact:digest({service:"hercules-deploy-controller",version:"1.9.0"}),
 config:digest({policy:"deployment-required",operatorInteraction:"conversation_only",manualOperatorStepsAllowed:false}),
 identity:"supabase:hercules-deploy-controller",
 policy:"guardian-deploy-controller-health-v1"
});
const CLEANER_BASELINE=Object.freeze({
 artifact:digest({product:"Hercules Cleaner",version:"1.0.0",sourceCommit:CLEANER_COMMIT}),
 config:digest({evidenceSource:"authorized-device",recoveryCapsuleRequired:true,rollbackIdentityRequired:true}),
 identity:"cleaner:1.0.0:"+CLEANER_COMMIT,
 policy:"guardian-cleaner-release-v1"
});

async function createStudioEntry(){
 const reader=createStudioGuardianWatchtowerReader();
 const read=async()=>{
  const cycle=await reader();
  const state=cycle?.results?.find?.(x=>x?.id==="studio")?.guardian?.proof?.observed;
  return normalizedState(state,"Studio");
 };
 const baseline=await read();
 return Object.freeze({id:"studio",scope:"service",baseline,observe:read});
}

function forgeEntry(fetchImpl){
 const observe=async()=>{
  const body=await fetchJson(FORGE_URL,fetchImpl);
  if(body.ok!==true||body.service!=="hercules-forge-control-api"||body.version!=="1.6"||body.mode!=="production"||body.publicOrigin!=="https://sauceapproved-forge-control.onrender.com"){
   throw new Error("Forge health invariant failed");
  }
  return FORGE_BASELINE;
 };
 return Object.freeze({id:"forge",scope:"service",baseline:FORGE_BASELINE,observe});
}
function browserEntry(fetchImpl){
 const observe=async()=>{
  const body=await fetchJson(BROWSER_URL,fetchImpl);
  if(body.ok!==true||body.service!=="hercules-browser-standalone"||body.version!=="1.0.0"||body.engine!=="playwright-local-chromium"||body.rawCodeExecution!==false||body.antiBotBypass!==false){
   throw new Error("browser health invariant failed");
  }
  return BROWSER_BASELINE;
 };
 return Object.freeze({id:"runtime",scope:"control-plane",baseline:BROWSER_BASELINE,observe});
}
function deployEntry(fetchImpl){
 const observe=async()=>{
  const body=await fetchJson(DEPLOY_URL,fetchImpl);
  if(body.ok!==true||body.service!=="hercules-deploy-controller"||body.version!=="1.9.0"||body.policy!=="deployment-required"||body.operatorInteraction!=="conversation_only"||body.manualOperatorStepsAllowed!==false){
   throw new Error("Deploy controller health invariant failed");
  }
  return DEPLOY_BASELINE;
 };
 return Object.freeze({id:"deploy",scope:"control-plane",baseline:DEPLOY_BASELINE,observe});
}
function cleanerEntry(reader,baseline){
 const expected=normalizedState(baseline??CLEANER_BASELINE,"Cleaner baseline");
 const observe=async()=>{
  if(typeof reader!=="function")throw new Error("Cleaner device evidence unavailable");
  return normalizedState(await reader(),"Cleaner");
 };
 return Object.freeze({id:"cleaner",scope:"device-service",baseline:expected,observe});
}

export async function createProductionGuardianCatalog({fetchImpl=globalThis.fetch,cleanerEvidenceReader=null,cleanerBaseline=null}={}){
 if(typeof fetchImpl!=="function")throw new Error("Guardian fetch implementation is required");
 return createWatchtowerRegistry([
  await createStudioEntry(),
  forgeEntry(fetchImpl),
  deployEntry(fetchImpl),
  cleanerEntry(cleanerEvidenceReader,cleanerBaseline),
  browserEntry(fetchImpl)
 ]);
}

export async function createProductionGuardianRuntime({fetchImpl=globalThis.fetch,cleanerEvidenceReader=null,cleanerBaseline=null,intervalMs=60000}={}){
 const catalog=await createProductionGuardianCatalog({fetchImpl,cleanerEvidenceReader,cleanerBaseline});
 return createCanonicalWatchtowerRuntime({catalogFactory:async()=>catalog,intervalMs});
}
