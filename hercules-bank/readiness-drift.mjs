import {createHash,randomUUID} from "node:crypto";
import {mkdir,readFile,rename,rm,writeFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";

const SCHEMA="sauceapproved.hercules.financial-readiness-drift";
const VERSION=1;
const MAX_EVENTS=500;
const CONTROL_NAMES=Object.freeze([
  "regulatedMoney",
  "transactionalStore",
  "secretCustody",
  "recovery",
  "caseOperations",
  "providerCertification",
  "adapterQualification",
]);

function nonEmpty(value,label,max=4096){
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
function hash(value){
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
function clone(value){return structuredClone(value)}
function emptyState(){return {schema:SCHEMA,version:VERSION,events:[],headHash:null}}

function controlReady(name,value){
  if(name==="providerCertification")return value?.certified===true;
  return value?.ready===true;
}

function sanitizeDossier(dossier){
  if(!dossier||typeof dossier!=="object"||Array.isArray(dossier))throw new TypeError("readiness dossier is required");
  if(dossier.activationAllowed!==false||dossier.externalRailsEnabled!==false){
    throw new Error("readiness drift sentinel requires activation to remain locked");
  }
  const controls=dossier.controls&&typeof dossier.controls==="object"?dossier.controls:{};
  const normalizedControls={};
  for(const name of CONTROL_NAMES)normalizedControls[name]=controlReady(name,controls[name]);

  const adapter=controls.adapterQualification&&typeof controls.adapterQualification==="object"
    ?controls.adapterQualification
    :{};

  return Object.freeze({
    ready:dossier.ready===true,
    blockerCount:Array.isArray(dossier.blockers)?dossier.blockers.length:0,
    controls:Object.freeze(normalizedControls),
    adapterQualification:Object.freeze({
      ready:adapter.ready===true,
      stale:adapter.stale===true,
      identityChanged:adapter.identityChanged===true,
      expiresAt:typeof adapter.expiresAt==="string"?adapter.expiresAt:null,
    }),
  });
}

function eventCore(event){
  return {
    sequence:event.sequence,
    checkedAt:event.checkedAt,
    snapshot:event.snapshot,
    findings:event.findings,
    previousHash:event.previousHash,
    activationAllowed:false,
    externalRailsEnabled:false,
  };
}
function eventHash(event){return hash(eventCore(event))}
function assertEventShape(event){
  if(!event||typeof event!=="object"||Array.isArray(event))throw new Error("readiness drift event is invalid");
  const expected=[
    "activationAllowed","checkedAt","externalRailsEnabled","findings","hash","previousHash","sequence","snapshot",
  ];
  if(JSON.stringify(Object.keys(event).sort())!==JSON.stringify(expected)){
    throw new Error("readiness drift event shape integrity failure");
  }
}
function verifyState(snapshot){
  if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))throw new Error("readiness drift snapshot is invalid");
  if(snapshot.schema!==SCHEMA)throw new Error("readiness drift schema mismatch");
  if(snapshot.version!==VERSION)throw new Error("readiness drift version mismatch");
  if(!Array.isArray(snapshot.events))throw new Error("readiness drift events are invalid");
  let previousHash=null;
  for(let index=0;index<snapshot.events.length;index+=1){
    const event=snapshot.events[index];
    assertEventShape(event);
    if(event.sequence!==index+1)throw new Error("readiness drift sequence integrity failure");
    if(event.previousHash!==previousHash)throw new Error("readiness drift previous hash integrity failure");
    if(event.activationAllowed!==false||event.externalRailsEnabled!==false){
      throw new Error("readiness drift activation integrity failure");
    }
    if(event.hash!==eventHash(event))throw new Error("readiness drift hash integrity failure");
    previousHash=event.hash;
  }
  if(snapshot.headHash!==previousHash)throw new Error("readiness drift head hash integrity failure");
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

function finding(code,severity,message){
  return Object.freeze({code,severity,message});
}

function evaluateFindings(previous,current,now,warningHours){
  const findings=[];
  if(previous){
    if(previous.ready&& !current.ready){
      findings.push(finding("readiness_regression","critical","production readiness regressed from green to blocked"));
    }
    for(const name of CONTROL_NAMES){
      if(previous.controls[name]===true&&current.controls[name]!==true){
        findings.push(finding("control_regression:"+name,"critical",name+" regressed from ready to blocked"));
      }
    }
    if(current.blockerCount>previous.blockerCount){
      findings.push(finding("blockers_increased","warning","production readiness blocker count increased"));
    }
  }

  const adapter=current.adapterQualification;
  const expiresMs=adapter.expiresAt&&Number.isFinite(Date.parse(adapter.expiresAt))
    ?Date.parse(adapter.expiresAt)
    :null;
  const nowMs=Date.parse(now);
  const expired=expiresMs!==null&&expiresMs<=nowMs;

  if(adapter.stale||expired){
    findings.push(finding("qualification_stale","critical","adapter qualification evidence is stale or expired"));
  }
  if(adapter.identityChanged){
    findings.push(finding("qualification_identity_changed","critical","adapter identity changed and requalification is required"));
  }
  if(!adapter.stale&&!expired&&expiresMs!==null){
    const remainingHours=(expiresMs-nowMs)/(60*60*1000);
    if(remainingHours<=warningHours){
      findings.push(finding("qualification_expiry_warning","warning","adapter qualification evidence is approaching expiry"));
    }
  }
  return Object.freeze(findings);
}

export class HerculesReadinessDriftSentinel{
  #path;
  #state;
  #tail=Promise.resolve();

  constructor({statePath,state}={}){
    this.#path=resolve(nonEmpty(statePath,"statePath"));
    this.#state=verifyState(state);
  }

  static async open({statePath}={}){
    const path=resolve(nonEmpty(statePath,"statePath"));
    let state;
    try{
      state=verifyState(JSON.parse(await readFile(path,"utf8")));
    }catch(error){
      if(error?.code!=="ENOENT"&&!/ENOENT/.test(String(error?.message??"")))throw error;
      state=emptyState();
      await atomicWrite(path,state);
    }
    return new HerculesReadinessDriftSentinel({statePath:path,state});
  }

  snapshot(){return clone(this.#state)}

  check({dossier,now=new Date().toISOString(),warningHours=48}={}){
    const checkedAt=iso(now,"now");
    const warning=positiveInteger(warningHours,"warningHours",24*30);
    const current=sanitizeDossier(dossier);

    const operation=this.#tail.then(async()=>{
      const candidate=verifyState(this.#state);
      const previous=candidate.events.at(-1)?.snapshot??null;
      const findings=evaluateFindings(previous,current,checkedAt,warning);
      const event={
        sequence:candidate.events.length+1,
        checkedAt,
        snapshot:clone(current),
        findings:clone(findings),
        previousHash:candidate.headHash,
        activationAllowed:false,
        externalRailsEnabled:false,
        hash:"",
      };
      event.hash=eventHash(event);
      candidate.events.push(event);
      if(candidate.events.length>MAX_EVENTS)throw new Error("readiness drift event limit reached");
      candidate.headHash=event.hash;
      verifyState(candidate);
      await atomicWrite(this.#path,candidate);
      this.#state=candidate;
      return Object.freeze({
        regressed:findings.some((item)=>item.severity==="critical"),
        findings:Object.freeze(clone(findings)),
        checkedAt,
        previousReady:previous?.ready??null,
        currentReady:current.ready,
        activationAllowed:false,
        externalRailsEnabled:false,
      });
    });
    this.#tail=operation.catch(()=>{});
    return operation;
  }
}
