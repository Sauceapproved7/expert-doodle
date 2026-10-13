import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createSandboxHostPlan} from "../hercules-deploy/cloud/host-agent.mjs";
import {buildGatehouseHostReview} from "../hercules/gatehouse/host-review.mjs";

const now=Date.parse("2026-10-13T18:20:00Z");
const image="registry.example/hercules-smoke@sha256:"+"a".repeat(64);
const request={
 serviceId:"hc-smoke",releaseId:"release-1",sourceCommit:"a".repeat(40),
 artifactFingerprint:"b".repeat(64),publicOrigin:"https://example.com",
 target:{kind:"owned_linux",reference:"sandbox-01"}
};
const target={kind:"owned_linux",reference:"sandbox-01",environment:"sandbox",
 verified:true,verifiedAt:new Date(now-10000).toISOString(),runtime:"rootless_docker",
 runtimeUid:1000,incrementalMonthlyCostUsd:0,allowlistedImages:[image]};
const plan=createSandboxHostPlan(request,{targets:[target],image,now});

test("Gatehouse reviews an exact immutable plan but cannot approve or execute it",()=>{
 const v=buildGatehouseHostReview(plan,{action:"start",now});
 assert.equal(v.schema,"hercules.gatehouse.host-plan-review.v1");
 assert.equal(v.planDigest,plan.planDigest);
 assert.equal(v.serviceId,plan.serviceId);
 assert.equal(v.action,"start");
 assert.equal(v.scope,"read-only-sandbox-review");
 assert.equal(v.planSyntaxValid,true);
 assert.equal(v.declaredCostChangeUsd,0);
 assert.equal(v.actualCostVerified,false);
 assert.equal(v.ownerMachineVerified,false);
 assert.equal(v.ownerSignatureVerified,false);
 assert.equal(v.hostRuntimeVerified,false);
 assert.equal(v.readyForSandboxExecution,false);
 assert.equal(v.productionAuthorized,false);
 assert.equal(v.ownerApprovalGranted,false);
 assert.equal(v.externalOperations,0);
 assert.equal(v.nextRequiredGate,"owner_authorized_off_host_signer_and_verified_machine");
 assert.ok(v.blockers.includes("independent_provider_and_cost_unverified"));
 assert.ok(v.blockers.includes("host_rootless_runtime_unverified"));
 assert.ok(Object.isFrozen(v));
});
test("Rollback preview requires separate permit and never confers authority",()=>{
 const v=buildGatehouseHostReview(plan,{action:"rollback",now});
 assert.equal(v.action,"rollback");
 assert.equal(v.ownerSignatureVerified,false);
 assert.equal(v.readyForSandboxExecution,false);
 assert.ok(v.blockers.includes("separate_owner_signed_action_missing"));
});
test("Untrusted flags are never promoted into provider, owner, cost or execution proof",()=>{
 const review=buildGatehouseHostReview(plan,{
  action:"start",now,ownerApproved:true,verified:true,executionAuthorized:true,
  host:{providerIdentityVerified:true,costVerified:true},
  secret:"BAD-TOKEN",rawPrivateKey:"BAD-PRIVATE"
 });
 assert.equal(review.ownerApprovalGranted,false);
 assert.equal(review.actualCostVerified,false);
 assert.equal(review.ownerMachineVerified,false);
 assert.equal(review.readyForSandboxExecution,false);
 const printed=JSON.stringify(review);
 assert.doesNotMatch(printed,/BAD-TOKEN|BAD-PRIVATE|privateKey|ownerApproved/);
});
test("Malformed, mutable, privileged or unknown plans/actions are rejected",()=>{
 for(const [bad,params] of [
  [{...plan,planDigest:"0".repeat(64)},{}],
  [{...plan,commands:{...plan.commands,create:["container","run","--privileged"]}},{}],
  [{...plan,productionAuthorized:true},{}],
  [null,{}],[{},{}],
  [plan,{action:"deploy",now}],
  [plan,{action:"approve",now}],
 ])assert.throws(()=>buildGatehouseHostReview(bad,params),/plan_|gatehouse_|action_/);
});
test("No signer, network, child process, private-key access or mutation in the reviewer",()=>{
 const src=readFileSync(new URL("../hercules/gatehouse/host-review.mjs",import.meta.url),"utf8");
 for(const banned of ["createOwnerSignedPermit","createPrivateKey","node:child_process",
  "node:http","node:https","fetch(","spawn(","execFile(","createServer(","process.env"])
   assert.equal(src.includes(banned),false,banned);
});
