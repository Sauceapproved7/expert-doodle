import {createHash,randomUUID} from "node:crypto";
import {mkdir,readFile,rename,rm,writeFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";

import {
  evaluateRegulatedMoneyReadiness,
  reconcileExternalSettlements,
} from "./regulatory-boundary.mjs";

const SCHEMA="sauceapproved.hercules.financial-compliance";
const VERSION=1;
const CONTROLS=new Set([
  "partnerAuthorization",
  "jurisdictionAuthorization",
  "identityVerification",
  "amlProgram",
  "sanctionsScreening",
  "transactionMonitoring",
  "reconciliation",
  "disputes",
  "incidentResponse",
  "dataRetention",
  "legalReview",
  "custodialOwnershipRecords",
  "insuranceDisclosureReview",
]);
const EVIDENCE_STATUSES=new Set(["approved","pending","rejected"]);

function nonEmpty(value,label,max=256){
  if(typeof value!=="string"||value.trim()==="")throw new TypeError(label+" must be a non-empty string");
  const normalized=value.trim();
  if(normalized.length>max)throw new TypeError(label+" is too long");
  return normalized;
}
function clone(value){return structuredClone(value)}
function iso(value,label){
  const normalized=nonEmpty(value,label,64);
  if(!Number.isFinite(Date.parse(normalized)))throw new TypeError(label+" must be an ISO timestamp");
  return normalized;
}
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==="object"){
    return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonical(value[key])]));
  }
  return value;
}
function eventHash(event){
  return createHash("sha256").update(JSON.stringify(canonical({
    sequence:event.sequence,
    type:event.type,
    payload:event.payload,
    previousHash:event.previousHash,
  }))).digest("hex");
}
function appendEvent(state,type,payload){
  const event={
    sequence:state.events.length+1,
    type,
    payload:clone(payload),
    previousHash:state.headHash,
  };
  event.hash=eventHash(event);
  state.events.push(event);
  state.headHash=event.hash;
  applyEvent(state,event);
  return event;
}
function applyEvent(state,event){
  if(event.type==="evidence_recorded"){
    state.evidence[event.payload.control]={
      status:event.payload.status,
      reference:event.payload.reference,
      reviewedAt:event.payload.reviewedAt,
      actorId:event.payload.actorId,
    };
    return;
  }
  if(event.type==="provider_profile_set"){
    state.provider=clone(event.payload.profile);
    return;
  }
  if(event.type==="reconciliation_recorded"){
    state.reconciliations.push(clone(event.payload.summary));
    if(state.reconciliations.length>100)state.reconciliations.shift();
    return;
  }
  throw new Error("unknown compliance event type");
}
function emptyState(){
  return {
    schema:SCHEMA,
    version:VERSION,
    evidence:{},
    provider:null,
    reconciliations:[],
    events:[],
    headHash:null,
  };
}
function verifyAndRestore(snapshot){
  if(!snapshot||typeof snapshot!=="object")throw new TypeError("compliance snapshot must be an object");
  if(snapshot.schema!==SCHEMA)throw new Error("compliance snapshot schema mismatch");
  if(snapshot.version!==VERSION)throw new Error("compliance snapshot version mismatch");
  if(!snapshot.evidence||typeof snapshot.evidence!=="object"||Array.isArray(snapshot.evidence))throw new Error("compliance evidence shape is invalid");
  if(!Array.isArray(snapshot.reconciliations)||!Array.isArray(snapshot.events))throw new Error("compliance snapshot shape is invalid");

  const restored=emptyState();
  let previousHash=null;
  for(let i=0;i<snapshot.events.length;i+=1){
    const event=snapshot.events[i];
    if(!event||typeof event!=="object")throw new Error("compliance event is invalid");
    if(event.sequence!==i+1)throw new Error("compliance event sequence integrity failure");
    if(event.previousHash!==previousHash)throw new Error("compliance event previous hash integrity failure");
    if(event.hash!==eventHash(event))throw new Error("compliance event hash integrity failure");
    applyEvent(restored,event);
    restored.events.push(clone(event));
    restored.headHash=event.hash;
    previousHash=event.hash;
  }
  if(snapshot.headHash!==restored.headHash)throw new Error("compliance head hash integrity failure");
  if(JSON.stringify(restored.evidence)!==JSON.stringify(snapshot.evidence))throw new Error("compliance evidence replay integrity failure");
  if(JSON.stringify(restored.provider)!==JSON.stringify(snapshot.provider??null))throw new Error("compliance provider replay integrity failure");
  if(JSON.stringify(restored.reconciliations)!==JSON.stringify(snapshot.reconciliations))throw new Error("compliance reconciliation replay integrity failure");
  return restored;
}
async function atomicWrite(path,snapshot){
  await mkdir(dirname(path),{recursive:true});
  const temp=path+".tmp-"+process.pid+"-"+randomUUID();
  try{
    await writeFile(temp,JSON.stringify(snapshot,null,2)+"\n",{encoding:"utf8",mode:0o600,flag:"wx"});
    await rename(temp,path);
  }catch(error){
    await rm(temp,{force:true}).catch(()=>{});
    throw error;
  }
}
function loopback(hostname){
  const host=hostname.replace(/^\[|\]$/g,"").toLowerCase();
  return host==="127.0.0.1"||host==="localhost"||host==="::1";
}

export function validateComplianceProviderAdapter(adapter){
  if(!adapter||typeof adapter!=="object")throw new TypeError("compliance provider adapter is required");
  const providerId=nonEmpty(adapter.providerId,"providerId");
  const environment=nonEmpty(adapter.environment,"environment");
  const endpoint=new URL(nonEmpty(adapter.endpoint,"endpoint"));
  if(!["http:","https:"].includes(endpoint.protocol))throw new TypeError("compliance provider endpoint protocol is not allowed");
  if(environment==="production"&&endpoint.protocol!=="https:")throw new TypeError("production compliance provider endpoint must use HTTPS");
  if(environment!=="production"&&endpoint.protocol==="http:"&&!loopback(endpoint.hostname)){
    throw new TypeError("cleartext compliance provider endpoint is allowed only on loopback outside production");
  }
  for(const method of ["verifyCustomer","screenSanctions","assessTransaction"]){
    if(typeof adapter[method]!=="function")throw new TypeError(method+" compliance provider method is required");
  }
  return Object.freeze({
    providerId,
    environment,
    endpoint:endpoint.toString().replace(/\/$/,""),
    verifyCustomer:adapter.verifyCustomer,
    screenSanctions:adapter.screenSanctions,
    assessTransaction:adapter.assessTransaction,
  });
}

export class HerculesComplianceOperations{
  #path;
  #state;
  #tail=Promise.resolve();
  #now;

  constructor({statePath,state,now=()=>new Date().toISOString()}={}){
    this.#path=resolve(nonEmpty(statePath,"statePath",4096));
    this.#state=verifyAndRestore(state);
    if(typeof now!=="function")throw new TypeError("now must be a function");
    this.#now=now;
  }

  static async open({statePath,now}={}){
    const path=resolve(nonEmpty(statePath,"statePath",4096));
    let state;
    try{
      state=verifyAndRestore(JSON.parse(await readFile(path,"utf8")));
    }catch(error){
      if(error?.code!=="ENOENT"&&!/ENOENT/.test(String(error?.message??"")))throw error;
      state=emptyState();
      await atomicWrite(path,state);
    }
    return new HerculesComplianceOperations({statePath:path,state,...(now?{now}:{})});
  }

  snapshot(){return clone(this.#state)}

  summary({mode="production",jurisdiction="US-CT",programType="deposit_program"}={}){
    const readiness=evaluateRegulatedMoneyReadiness({
      mode,
      jurisdiction,
      programType,
      provider:this.#state.provider,
      controls:this.#state.evidence,
    });
    return Object.freeze({
      readiness,
      executionEnabled:false,
      evidence:clone(this.#state.evidence),
      provider:clone(this.#state.provider),
      latestReconciliation:clone(this.#state.reconciliations.at(-1)??null),
      reconciliationCount:this.#state.reconciliations.length,
    });
  }

  recordEvidence({control,status,reference,reviewedAt,actorId}={}){
    if(!CONTROLS.has(control))return Promise.reject(new TypeError("unsupported compliance control"));
    if(!EVIDENCE_STATUSES.has(status))return Promise.reject(new TypeError("unsupported evidence status"));
    const payload={
      control,
      status,
      reference:nonEmpty(reference,"reference",512),
      reviewedAt:iso(reviewedAt,"reviewedAt"),
      actorId:nonEmpty(actorId,"actorId",128),
    };
    return this.#commit("evidence_recorded",payload).then(()=>clone(this.#state.evidence[control]));
  }

  setProviderProfile({id,environment,endpoint,capabilities}={}){
    const normalizedEndpoint=new URL(nonEmpty(endpoint,"endpoint",2048));
    const normalizedEnvironment=nonEmpty(environment,"environment",32);
    if(normalizedEnvironment==="production"&&normalizedEndpoint.protocol!=="https:"){
      return Promise.reject(new TypeError("production provider endpoint must use HTTPS"));
    }
    if(!Array.isArray(capabilities)||capabilities.some((item)=>typeof item!=="string"||item.trim()==="")){
      return Promise.reject(new TypeError("provider capabilities must be non-empty strings"));
    }
    const profile={
      id:nonEmpty(id,"provider id",128),
      environment:normalizedEnvironment,
      endpoint:normalizedEndpoint.toString().replace(/\/$/,""),
      capabilities:[...new Set(capabilities.map((item)=>item.trim()))].sort(),
    };
    return this.#commit("provider_profile_set",{profile}).then(()=>clone(this.#state.provider));
  }

  recordReconciliation({actorId,runId,internal,provider}={}){
    const report=reconcileExternalSettlements({internal,provider});
    const summary={
      runId:nonEmpty(runId,"runId",128),
      actorId:nonEmpty(actorId,"actorId",128),
      recordedAt:this.#now(),
      ok:report.ok,
      missingProviderCount:report.missingProvider.length,
      unexpectedProviderCount:report.unexpectedProvider.length,
      amountMismatchCount:report.amountMismatches.length,
      currencyMismatchCount:report.currencyMismatches.length,
      duplicateCount:report.duplicates.length,
      executionEnabled:false,
    };
    return this.#commit("reconciliation_recorded",{summary}).then(()=>clone(summary));
  }

  #commit(type,payload){
    const operation=this.#tail.then(async()=>{
      const candidate=verifyAndRestore(this.#state);
      appendEvent(candidate,type,payload);
      verifyAndRestore(candidate);
      await atomicWrite(this.#path,candidate);
      this.#state=candidate;
    });
    this.#tail=operation.catch(()=>{});
    return operation;
  }
}
