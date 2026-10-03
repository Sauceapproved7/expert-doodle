const SHA=/^[a-f0-9]{64}$/i;
function requiredText(value,label){if(typeof value!=="string"||!value.trim())throw new Error(label+" is required");return value.trim()}
function requiredSha(value,label){if(!SHA.test(value??""))throw new Error(label+" is required");return value.toLowerCase()}

export function collectDeployPlaneEvidence(deployment={}){
  if(deployment.state?.status!=="verified"||deployment.state?.verificationEvidence?.verified!==true){
    throw new Error("verified deployment evidence is required");
  }
  const request=deployment.request??{};
  return Object.freeze({
    artifact:{sha256:requiredSha(request.artifact?.sha256,"artifact sha256")},
    config:{sha256:requiredSha(request.config?.sha256,"config sha256")},
    workload:{identity:requiredText(request.target?.identity,"workload identity")},
    policy:{id:requiredText(request.policy?.id,"policy id")},
    source:Object.freeze({kind:"hercules-deploy",deploymentId:requiredText(deployment.deploymentId,"deployment id")})
  });
}
