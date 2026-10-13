// Read-only Hercules Gatehouse review of a bounded Host Engine plan.
// Gatehouse is NEVER the owner signer, provider attestor or host executor.
// Inputs may be supplied by a caller; none can promote deployment authority.
import {assertSandboxHostPlan} from "../../hercules-deploy/cloud/host-agent.mjs";

function reject(code){throw new Error(code)}
export function buildGatehouseHostReview(plan,{action="start",now=Date.now()}={}){
 if(action!=="start"&&action!=="rollback")
  reject("gatehouse_action_invalid");
 if(!Number.isSafeInteger(now)||now<=0)
  reject("gatehouse_clock_invalid");
 assertSandboxHostPlan(plan);
 const blockers=Object.freeze([
  "independent_provider_and_cost_unverified",
  "owner_machine_identity_unverified",
  "host_rootless_runtime_unverified",
  "separate_owner_signed_action_missing",
  "sandbox_permit_replay_status_unverified",
 ]);
 // These fields communicate the *contents* of a plan, not outside proof that
 // the intended VM, account, image or host runtime exists.
 return Object.freeze({
  schema:"hercules.gatehouse.host-plan-review.v1",
  scope:"read-only-sandbox-review",
  planDigest:plan.planDigest,
  serviceId:plan.serviceId,
  releaseId:plan.releaseId,
  action,
  planSyntaxValid:true,
  immutableImageDeclared:true,
  networkIsolationDeclared:plan.limits.network==="none",
  declaredCostChangeUsd:plan.costChangeUsd,
  actualCostVerified:false,
  providerIdentityVerified:false,
  ownerMachineVerified:false,
  hostRuntimeVerified:false,
  ownerSignatureVerified:false,
  replayProtectionVerifiedForAction:false,
  ownerApprovalGranted:false,
  readyForSandboxExecution:false,
  productionAuthorized:false,
  externalOperations:0,
  blockers,
  nextRequiredGate:"owner_authorized_off_host_signer_and_verified_machine",
 });
}
