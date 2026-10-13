import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessOciA1Host} from "../hercules-deploy/cloud/oci-a1-host-readiness.mjs";

const now=Date.parse("2026-10-13T16:30:00Z");
const GiB=1024**3;
function evidence(overrides={}){
 return {
   osId:"ubuntu",osVersion:"24.04",architecture:"aarch64",
   logicalCpus:2,memoryBytes:11*GiB,availableDiskBytes:30*GiB,
   userUid:1000,dockerSocket:"/run/user/1000/docker.sock",
   dockerSocketType:"socket",dockerSocketOwnerUid:1000,
   dockerSecurityOptions:["name=rootless"],observedAt:now-10000,
   ...overrides
 };
}
test("accepts a real-host-shaped A1 Ubuntu ARM64 observation only as a local preflight",()=>{
 const result=assessOciA1Host(evidence(),{now});
 assert.equal(result.localTechnicalPreflightPassed,true);
 assert.equal(result.observedArchitecture,"arm64");
 assert.equal(result.expectedProvider,"oracle_cloud_infrastructure");
 assert.equal(result.providerIdentityVerified,false);
 assert.equal(result.incrementalMonthlyCostVerified,false);
 assert.equal(result.serverOwnedByUserVerified,false);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.productionAuthorized,false);
 assert.equal(result.hostRegistered,false);
 assert.equal(result.nextStage,"independent_provider_and_owner_attestation");
 assert.ok(result.controls.every(x=>x.passed));
});
test("unsupported architecture, Linux image or resource limits never pass",()=>{
 for(const change of [
  {architecture:"x64"},{architecture:"amd64"},{osId:"windows"},
  {osVersion:"23.10"},{logicalCpus:1},{memoryBytes:8*GiB},
  {availableDiskBytes:8*GiB},{logicalCpus:"2"},
 ]){
  const result=assessOciA1Host(evidence(change),{now});
  assert.equal(result.localTechnicalPreflightPassed,false,JSON.stringify(change));
 }
});
test("rootful, wrong-user, absent or suspicious Docker sockets cannot pass",()=>{
 for(const change of [
  {userUid:0},{userUid:999},{dockerSocket:"/var/run/docker.sock"},
  {dockerSocket:"unix:///var/run/docker.sock"},
  {dockerSocket:"/run/user/1001/docker.sock"},
  {dockerSocketType:"symlink"},{dockerSocketType:"regular"},
  {dockerSocketOwnerUid:0},{dockerSecurityOptions:["name=seccomp,profile=default"]},
  {dockerSecurityOptions:["name=rootless","unexpected-root-privilege"]},
 ]){
  const result=assessOciA1Host(evidence(change),{now});
  assert.equal(result.localTechnicalPreflightPassed,false,JSON.stringify(change));
 }
});
test("stale, future or invalid observation cannot be used as current host proof",()=>{
 for(const change of [
  {observedAt:now-16*60*1000},{observedAt:now+31000},
  {observedAt:"2026-10-13T16:30:00Z"},{observedAt:0},
 ]){
  assert.equal(assessOciA1Host(evidence(change),{now}).localTechnicalPreflightPassed,false);
 }
});
test("assertions of OCI ownership, free billing or provider instance never grant authority",()=>{
 const input=evidence({
  provider:"oci",instanceId:"ocid1.instance.fake",homeRegion:true,
  verified:true,executionAuthorized:true,productionAuthorized:true,
  incrementalMonthlyCostUsd:0,secret:"not-for-logs",publicIp:"203.0.113.77",
 });
 const result=assessOciA1Host(input,{now});
 assert.equal(result.localTechnicalPreflightPassed,true);
 assert.equal(result.providerIdentityVerified,false);
 assert.equal(result.incrementalMonthlyCostVerified,false);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.productionAuthorized,false);
 assert.equal(result.registeredHostVerified,false);
 const str=JSON.stringify(result);
 for(const forbidden of ["ocid1.instance.fake","not-for-logs","203.0.113.77"])
   assert.doesNotMatch(str,new RegExp(forbidden.replaceAll(".","\\.")));
});
test("missing evidence is blocked instead of trusting defaults",()=>{
 for(const input of [null,{},[],false,{architecture:"arm64"},evidence({dockerSecurityOptions:null})]){
  const result=assessOciA1Host(input,{now});
  assert.equal(result.localTechnicalPreflightPassed,false);
  assert.equal(result.executionAuthorized,false);
 }
});
test("external costing/capacity and rootless installation cannot be performed by module import",()=>{
 const src=readFileSync(new URL("../hercules-deploy/cloud/oci-a1-host-readiness.mjs",import.meta.url),"utf8");
 for(const banned of ["node:child_process","node:http","node:https","node:net","fetch(",
   "createServer(","listen(","execFile(","spawn(","DOCKER_HOST","OCID1."])
   assert.equal(src.includes(banned),false,banned);
});
