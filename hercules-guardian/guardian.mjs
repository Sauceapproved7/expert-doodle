import {createHash} from "node:crypto";

const REQUIRED_FIELDS=["artifact","config","identity","policy"];

function stable(value){
  if(Array.isArray(value)) return "["+value.map(stable).join(",")+"]";
  if(value&&typeof value==="object"){
    return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stable(value[k])).join(",")+"}";
  }
  return JSON.stringify(value);
}

function proofId(payload){
  return "guardian-proof-"+createHash("sha256").update(stable(payload)).digest("hex").slice(0,24);
}

export function evaluateGuardianState(input={}){
  const expected=input.expected??{};
  const observed=input.observed??{};
  const target=input.target??{};
  if(typeof target.id!=="string"||!target.id.trim()) throw new TypeError("target.id is required");
  if(typeof target.scope!=="string"||!target.scope.trim()) throw new TypeError("target.scope is required");

  const drift=[];
  for(const field of REQUIRED_FIELDS){
    if(!(field in expected)){
      drift.push({field,reason:"missing_baseline",expected:null,observed:observed[field]??null});
      continue;
    }
    if(!(field in observed)){
      drift.push({field,reason:"missing_observation",expected:expected[field],observed:null});
      continue;
    }
    if(observed[field]!==expected[field]){
      drift.push({field,reason:"mismatch",expected:expected[field],observed:observed[field]});
    }
  }

  const denied=drift.length>0;
  const evidence={
    schema:"sauceapproved.hercules.guardian-proof.v0.1",
    target:{id:target.id,scope:target.scope},
    expected,
    observed,
    drift
  };

  return {
    verdict:denied?"deny":"allow",
    drift,
    containment:denied
      ?{required:true,mode:"blast-radius-lock",target:target.id,scope:target.scope,action:"isolate_target_only"}
      :{required:false,mode:"none",target:target.id,scope:target.scope,action:"none"},
    recovery:{required:denied,handoff:denied?"hercules-time-machine":null},
    proof:{id:proofId(evidence),...evidence}
  };
}
