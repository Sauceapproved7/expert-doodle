// Owner-controlled Hercules Host Engine V1. The module has NO network,
// child-process import, signature minting, registry mutation or public API.
// Caller must provide an externally signed one-use permit and an explicitly
// authorized Linux operator's execFile implementation.
import {assertSandboxHostPlan,executeSandboxHostPlan,rollbackSandboxHostPlan} from "./host-agent.mjs";
import {createBoundedDockerRunner,createDurableNonceStore} from "./host-local.mjs";
import {assessOciA1Host} from "./oci-a1-host-readiness.mjs";

function deny(reason){throw new Error(reason)}
const SAFE_MODE=0o077;

export function assertHostEngineOperator(plan,{
  observation,processUid,socketStat,now=Date.now()
}={}){
  assertSandboxHostPlan(plan);
  const assessment=assessOciA1Host(observation,{now});
  const uid=Number.isSafeInteger(processUid)?processUid:NaN;
  if(!assessment.localTechnicalPreflightPassed)
    deny("local_host_preflight_unverified");
  if(uid<1000||uid>65535||uid!==plan.runtimeUid)
    deny("host_operator_identity_unverified");
  if(!socketStat||typeof socketStat.isSocket!=="function"||
    !socketStat.isSocket()||socketStat.uid!==uid||
    !Number.isInteger(socketStat.mode)||(socketStat.mode&SAFE_MODE)!==0)
    deny("socket_ownership_unverified");
  if(observation.userUid!==uid||
    observation.dockerSocket!=="/run/user/"+uid+"/docker.sock")
    deny("host_operator_identity_unverified");
  return Object.freeze({
    schema:"hercules.cloud.host-operator-local.v1",
    localOperatorVerified:true,
    observedArchitecture:assessment.observedArchitecture,
    providerCostVerified:false,
    independentHostingMachineVerified:false,
    productionApproved:false,
    nextStage:"provider_backed_instance_and_owner_attestation",
  });
}

export async function runHostEngineOperation({
  action,plan,permit,signingKey,root,observation,
  processUid,socketStat,execFileImpl,
  enableSandbox=false,now=Date.now()
}={}){
  if(enableSandbox!==true)deny("sandbox_disabled");
  if(!["start","rollback"].includes(action))deny("engine_action_invalid");
  if(!permit||typeof permit!=="object")deny("permit_invalid");
  if(typeof signingKey!=="string"||signingKey.length<32)
    deny("signing_key_required");
  // Refuse even a valid owner permit when local host identity is unproven.
  const operator=assertHostEngineOperator(plan,{observation,processUid,socketStat,now});
  if(typeof execFileImpl!=="function")deny("engine_runner_unavailable");
  const runCommand=createBoundedDockerRunner(plan,{execFileImpl});
  const consumeNonce=await createDurableNonceStore({root});
  const options={permit,signingKey,runCommand,consumeNonce,now};
  const receipt=action==="start"
    ?await executeSandboxHostPlan(plan,options)
    :await rollbackSandboxHostPlan(plan,options);
  return Object.freeze({
    schema:"hercules.cloud.host-engine.sandbox-receipt.v1",
    action,
    planDigest:receipt.planDigest,
    containerName:receipt.containerName,
    sandboxRunningVerified:action==="start"&&receipt.runningVerified===true,
    rolledBack:action==="rollback"&&receipt.rolledBack===true,
    localOperatorVerified:operator.localOperatorVerified,
    independentHostingMachineVerified:false,
    providerCostVerified:false,
    hostRegistered:false,
    executionAuthorizedForProduction:false,
    publicReleaseApproved:false,
  });
}
