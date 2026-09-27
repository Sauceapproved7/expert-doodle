import {createHash,randomUUID} from "node:crypto";
import {mkdir,readFile,rename,rm,writeFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";

const SCHEMA="sauceapproved.hercules.financial-qualification-evidence";
const VERSION=1;
const MAX_RECORDS=100;

function nonEmpty(value,label,max=512){
  if(typeof value!=="string"||value.trim()==="")throw new TypeError(label+" must be a non-empty string");
  const normalized=value.trim();
  if(normalized.length>max)throw new TypeError(label+" is too long");
  return normalized;
}
function iso(value,label){
  const normalized=nonEmpty(value,label,64);
  if(!Number.isFinite(Date.parse(normalized)))throw new TypeError(label+" must be a valid timestamp");
  return normalized;
}
function positiveInteger(value,label,max){
  if(!Number.isSafeInteger(value)||value<=0)throw new TypeError(label+" must be a positive safe integer");
  if(max!==undefined&&value>max)throw new RangeError(label+" exceeds supported bound");
  return value;
}
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==="object"){
    return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonical(value[key])]));
  }
  return value;
}
function digestObject(value){
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest();
}
function hashHex(value){return digestObject(value).toString("hex")}
function clone(value){return structuredClone(value)}

function sanitizedIdentity(qualification){
  if(!qualification||typeof qualification!=="object")throw new TypeError("qualification result is required");
  if(qualification.qualified!==true)throw new Error("qualification result must be qualified");
  if(qualification.activationAllowed!==false||qualification.externalRailsEnabled!==false){
    throw new Error("qualification result must keep activation and external rails disabled");
  }
  const checks=qualification.checks??{};
  const store=checks.transactionalStore;
  const custody=checks.secretCustody;
  const provider=checks.regulatedProvider;
  if(store?.qualified!==true||custody?.qualified!==true||provider?.qualified!==true){
    throw new Error("all production adapter checks must be qualified");
  }
  return Object.freeze({
    transactionalStore:Object.freeze({
      id:nonEmpty(store.id,"transactional store id",256),
      environment:nonEmpty(store.environment,"transactional store environment",32),
    }),
    secretCustody:Object.freeze({
      providerId:nonEmpty(custody.providerId,"secret custody providerId",256),
      environment:nonEmpty(custody.environment,"secret custody environment",32),
      keyId:nonEmpty(custody.keyId,"secret custody keyId",256),
    }),
    regulatedProvider:Object.freeze({
      providerId:nonEmpty(provider.providerId,"regulated providerId",256),
      environment:nonEmpty(provider.environment,"regulated provider environment",32),
      endpoint:nonEmpty(provider.endpoint,"regulated provider endpoint",2048),
      externalMoneyMovement:provider.externalMoneyMovement===true,
      custodialDeposits:provider.custodialDeposits===true,
      sandboxOrDryRun:provider.sandboxOrDryRun===true,
    }),
  });
}

export function qualificationIdentityFingerprint(qualification){
  return hashHex(sanitizedIdentity(qualification));
}

function emptyState(){
  return {schema:SCHEMA,version:VERSION,records:[],headHash:null};
}

function recordCore(record){
  return {
    sequence:record.sequence,
    qualifiedAt:record.qualifiedAt,
    expiresAt:record.expiresAt,
    identityFingerprint:record.identityFingerprint,
    identity:record.identity,
    signerKeyId:record.signerKeyId,
    activationAllowed:false,
    externalRailsEnabled:false,
    previousHash:record.previousHash,
  };
}

function recordHash(record){return hashHex(recordCore(record))}
function recordDigest(record){return digestObject(recordCore(record))}

function assertRecordShape(record){
  if(!record||typeof record!=="object"||Array.isArray(record))throw new Error("qualification evidence record is invalid");
  const expected=[
    "activationAllowed","expiresAt","externalRailsEnabled","hash","identity","identityFingerprint",
    "previousHash","qualifiedAt","sequence","signature","signerKeyId",
  ];
  const actual=Object.keys(record).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error("qualification evidence record shape integrity failure");
}

async function verifyState(snapshot,verifier){
  if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))throw new Error("qualification evidence snapshot is invalid");
  if(snapshot.schema!==SCHEMA)throw new Error("qualification evidence schema mismatch");
  if(snapshot.version!==VERSION)throw new Error("qualification evidence version mismatch");
  if(!Array.isArray(snapshot.records))throw new Error("qualification evidence records are invalid");
  if(!verifier||typeof verifier.verifyDigest!=="function")throw new TypeError("qualification evidence verifier is required");

  let previousHash=null;
  for(let index=0;index<snapshot.records.length;index+=1){
    const record=snapshot.records[index];
    assertRecordShape(record);
    if(record.sequence!==index+1)throw new Error("qualification evidence sequence integrity failure");
    if(record.previousHash!==previousHash)throw new Error("qualification evidence previous hash integrity failure");
    if(record.activationAllowed!==false||record.externalRailsEnabled!==false){
      throw new Error("qualification evidence activation integrity failure");
    }
    if(record.identityFingerprint!==hashHex(record.identity))throw new Error("qualification identity fingerprint integrity failure");
    if(record.hash!==recordHash(record))throw new Error("qualification evidence hash integrity failure");
    const signature=Buffer.from(nonEmpty(record.signature,"qualification evidence signature",16384),"base64");
    if(signature.length===0)throw new Error("qualification evidence signature is empty");
    const verified=await verifier.verifyDigest({
      keyId:nonEmpty(record.signerKeyId,"signerKeyId",256),
      digest:recordDigest(record),
      signature,
    });
    if(verified!==true)throw new Error("qualification evidence signature verification failed");
    previousHash=record.hash;
  }
  if(snapshot.headHash!==previousHash)throw new Error("qualification evidence head hash integrity failure");
  return clone(snapshot);
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

export class HerculesQualificationEvidenceStore{
  #path;
  #state;
  #verifier;
  #tail=Promise.resolve();

  constructor({statePath,state,verifier}={}){
    this.#path=resolve(nonEmpty(statePath,"statePath",4096));
    this.#state=clone(state);
    if(!verifier||typeof verifier.verifyDigest!=="function")throw new TypeError("qualification evidence verifier is required");
    this.#verifier=verifier;
  }

  static async open({statePath,verifier}={}){
    const path=resolve(nonEmpty(statePath,"statePath",4096));
    let state;
    try{
      state=await verifyState(JSON.parse(await readFile(path,"utf8")),verifier);
    }catch(error){
      if(error?.code!=="ENOENT"&&!/ENOENT/.test(String(error?.message??"")))throw error;
      state=emptyState();
      await atomicWrite(path,state);
    }
    return new HerculesQualificationEvidenceStore({statePath:path,state,verifier});
  }

  snapshot(){return clone(this.#state)}

  async recordQualification({qualification,signer,qualifiedAt,ttlHours=168}={}){
    if(!signer||typeof signer.signDigest!=="function")throw new TypeError("qualification signer is required");
    const signerKeyId=nonEmpty(signer.keyId,"qualification signer keyId",256);
    const identity=sanitizedIdentity(qualification);
    const identityFingerprint=hashHex(identity);
    const qualified=iso(qualifiedAt,"qualifiedAt");
    const ttl=positiveInteger(ttlHours,"ttlHours",24*90);
    const qualifiedMs=Date.parse(qualified);
    const expiresAt=new Date(qualifiedMs+ttl*60*60*1000).toISOString();

    const operation=this.#tail.then(async()=>{
      const candidate=await verifyState(this.#state,this.#verifier);
      const record={
        sequence:candidate.records.length+1,
        qualifiedAt:qualified,
        expiresAt,
        identityFingerprint,
        identity:clone(identity),
        signerKeyId,
        activationAllowed:false,
        externalRailsEnabled:false,
        previousHash:candidate.headHash,
        hash:"",
        signature:"",
      };
      record.hash=recordHash(record);
      const signature=await signer.signDigest(recordDigest(record));
      if(!(signature instanceof Uint8Array)||signature.byteLength===0)throw new Error("qualification signer returned an invalid signature");
      record.signature=Buffer.from(signature).toString("base64");
      const verified=await this.#verifier.verifyDigest({
        keyId:signerKeyId,
        digest:recordDigest(record),
        signature:Buffer.from(signature),
      });
      if(verified!==true)throw new Error("qualification evidence signature self-verification failed");
      candidate.records.push(record);
      if(candidate.records.length>MAX_RECORDS)throw new Error("qualification evidence record limit reached");
      candidate.headHash=record.hash;
      await verifyState(candidate,this.#verifier);
      await atomicWrite(this.#path,candidate);
      this.#state=candidate;
      return clone(record);
    });
    this.#tail=operation.catch(()=>{});
    return operation;
  }

  async status({currentQualification,now=new Date().toISOString()}={}){
    await verifyState(this.#state,this.#verifier);
    const blockers=[];
    const latest=this.#state.records.at(-1)??null;
    if(!latest){
      return Object.freeze({
        ready:false,
        stale:false,
        identityChanged:false,
        qualifiedAt:null,
        expiresAt:null,
        blockers:Object.freeze(["qualification evidence is missing"]),
        activationAllowed:false,
        externalRailsEnabled:false,
      });
    }

    const nowMs=Date.parse(iso(now,"now"));
    const stale=nowMs>=Date.parse(latest.expiresAt);
    if(stale)blockers.push("qualification evidence is stale or expired");

    let currentFingerprint=null;
    try{currentFingerprint=qualificationIdentityFingerprint(currentQualification)}
    catch(error){blockers.push("current adapter qualification is not green: "+error.message)}
    const identityChanged=currentFingerprint!==null&&currentFingerprint!==latest.identityFingerprint;
    if(identityChanged)blockers.push("adapter, key, or provider identity changed; requalification is required");

    return Object.freeze({
      ready:blockers.length===0,
      stale,
      identityChanged,
      qualifiedAt:latest.qualifiedAt,
      expiresAt:latest.expiresAt,
      signerKeyId:latest.signerKeyId,
      identityFingerprint:latest.identityFingerprint,
      blockers:Object.freeze(blockers),
      activationAllowed:false,
      externalRailsEnabled:false,
    });
  }
}
