const SHA=/^[a-f0-9]{64}$/i;

function shaEvidence(name,value){
  const sha=value?.sha256;
  if(!SHA.test(sha??"")) throw new Error(name+" evidence is required");
  return "sha256:"+sha.toLowerCase();
}

function textEvidence(name,value){
  if(typeof value!=="string"||!value.trim()) throw new Error(name+" evidence is required");
  return value.trim();
}

export function collectGuardianEvidence(input={}){
  return Object.freeze({
    artifact:shaEvidence("artifact",input.artifact),
    config:shaEvidence("config",input.config),
    identity:textEvidence("workload identity",input.workload?.identity),
    policy:textEvidence("policy",input.policy?.id)
  });
}
