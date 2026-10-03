import {collectGuardianEvidence} from "./collector.mjs";

export function collectRenderServiceEvidence(service={},bindings={}){
  if(typeof service.id!=="string"||typeof service.name!=="string") throw new Error("service identity is required");
  const identity=["render",service.id,service.name].join(":");
  return collectGuardianEvidence({
    artifact:{sha256:bindings.artifactSha256},
    config:{sha256:bindings.configSha256},
    workload:{identity},
    policy:{id:bindings.policyId}
  });
}
