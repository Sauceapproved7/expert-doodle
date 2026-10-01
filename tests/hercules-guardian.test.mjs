import test from "node:test";
import assert from "node:assert/strict";
import {evaluateGuardianState} from "../hercules-guardian/guardian.mjs";

test("healthy state produces an allow verdict with no containment", () => {
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:aaa",config:"sha256:bbb",identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:aaa",config:"sha256:bbb",identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  assert.equal(result.verdict,"allow");
  assert.equal(result.containment.required,false);
  assert.deepEqual(result.drift,[]);
  assert.match(result.proof.id,/^guardian-proof-/);
});

test("artifact drift fails closed and scopes containment to the affected target", () => {
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:aaa",config:"sha256:bbb",identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:evil",config:"sha256:bbb",identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  assert.equal(result.verdict,"deny");
  assert.equal(result.containment.required,true);
  assert.equal(result.containment.target,"studio-api");
  assert.equal(result.containment.scope,"service");
  assert.deepEqual(result.drift.map(x=>x.field),["artifact"]);
  assert.equal(result.recovery.required,true);
});

test("missing evidence is drift rather than implicit trust", () => {
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:aaa",config:"sha256:bbb",identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:aaa",config:"sha256:bbb",identity:"svc-studio"},
    target:{id:"studio-api",scope:"service"}
  });
  assert.equal(result.verdict,"deny");
  assert.equal(result.drift[0].field,"policy");
  assert.equal(result.drift[0].reason,"missing_observation");
});


test("collector converts runtime evidence into the canonical Guardian dimensions", async () => {
  const {collectGuardianEvidence}=await import("../hercules-guardian/collector.mjs");
  const evidence=collectGuardianEvidence({
    artifact:{sha256:"a".repeat(64)},
    config:{sha256:"b".repeat(64)},
    workload:{identity:"svc-studio"},
    policy:{id:"policy-v1"}
  });
  assert.deepEqual(evidence,{
    artifact:"sha256:"+"a".repeat(64),
    config:"sha256:"+"b".repeat(64),
    identity:"svc-studio",
    policy:"policy-v1"
  });
});

test("collector fails closed when a required runtime evidence source is absent", async () => {
  const {collectGuardianEvidence}=await import("../hercules-guardian/collector.mjs");
  assert.throws(()=>collectGuardianEvidence({
    artifact:{sha256:"a".repeat(64)},
    config:{sha256:"b".repeat(64)},
    workload:{identity:"svc-studio"}
  }),/policy evidence is required/);
});


test("Guardian verdict can be bound into the canonical Hercules Proof Object", async () => {
  const {createGuardianProofObject}=await import("../hercules-guardian/proof-adapter.mjs");
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  const proof=createGuardianProofObject({
    guardianResult:result,
    authorizationEvidenceSha256:"c".repeat(64)
  });
  assert.equal(proof.schema,"hercules.proof.object.v1");
  assert.equal(proof.executionAuthority,false);
  assert.equal(proof.verification.status,"VERIFIED_HEALTHY");
  assert.match(proof.proofSha256,/^[a-f0-9]{64}$/);
});


test("containment gate produces approval-gated lifecycle only for verified drift", async () => {
  const {createGuardianContainmentProposal}=await import("../hercules-guardian/containment-gate.mjs");
  const auth="d".repeat(64);
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:"+"f".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  const proposal=createGuardianContainmentProposal({guardianResult:result,authorizationEvidenceSha256:auth});
  assert.equal(proposal.lifecycle.state,"READY_FOR_AUTHORIZED_EXECUTION");
  assert.equal(proposal.lifecycle.requiresApproval,true);
  assert.equal(proposal.lifecycle.executionAuthority,false);
  assert.equal(proposal.consequence.action.target,"studio-api");
  assert.equal(proposal.recovery.executionAuthority,false);
});

test("containment gate refuses healthy state", async () => {
  const {createGuardianContainmentProposal}=await import("../hercules-guardian/containment-gate.mjs");
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  assert.throws(()=>createGuardianContainmentProposal({guardianResult:result,authorizationEvidenceSha256:"d".repeat(64)}),/verified drift required/);
});


test("Render adapter binds deployment metadata without secrets", async () => {
  const {collectRenderServiceEvidence}=await import("../hercules-guardian/render-adapter.mjs");
  const e=collectRenderServiceEvidence({
    id:"srv-studio",name:"sauceapproved-studio",branch:"main",repo:"https://github.com/Sauceapproved7/expert-doodle",
    suspended:"not_suspended",serviceDetails:{runtime:"node",url:"https://sauceapproved-studio.onrender.com"}
  },{artifactSha256:"a".repeat(64),configSha256:"b".repeat(64),policyId:"guardian-studio-v1"});
  assert.equal(e.identity,"render:srv-studio:sauceapproved-studio");
  assert.equal(e.artifact,"sha256:"+"a".repeat(64));
  assert.equal(e.config,"sha256:"+"b".repeat(64));
  assert.equal(e.policy,"guardian-studio-v1");
  assert.equal("sshAddress" in e,false);
});


test("deployment adapter extracts only verified secret-free evidence", async () => {
  const {collectDeployPlaneEvidence}=await import("../hercules-guardian/deploy-plane-adapter.mjs");
  const evidence=collectDeployPlaneEvidence({
    deploymentId:"deploy-1",
    request:{artifact:{sha256:"a".repeat(64)},target:{identity:"svc-studio"},policy:{id:"policy-v1"},config:{sha256:"b".repeat(64)}},
    state:{status:"verified",verificationEvidence:{verified:true}}
  });
  assert.equal(evidence.artifact.sha256,"a".repeat(64));
  assert.equal(evidence.workload.identity,"svc-studio");
});

test("deployment adapter rejects unverified deployments", async () => {
  const {collectDeployPlaneEvidence}=await import("../hercules-guardian/deploy-plane-adapter.mjs");
  assert.throws(()=>collectDeployPlaneEvidence({
    deploymentId:"deploy-1",request:{},state:{status:"verifying",verificationEvidence:null}
  }),/verified deployment evidence is required/);
});

test("containment authorization gate never treats Guardian proof as authority", async () => {
  const {planGuardianContainment}=await import("../hercules-guardian/containment-gate.mjs");
  const plan=planGuardianContainment({
    guardianResult:{verdict:"deny",containment:{required:true,target:"studio-api",scope:"service",action:"isolate_target_only"},proof:{id:"guardian-proof-x"}},
    authorization:null
  });
  assert.equal(plan.executionAuthority,false);
  assert.equal(plan.status,"AWAITING_AUTHORIZATION");
});


test("containment executor defaults to dry-run and performs no mutation", async () => {
  const {executeGuardianContainment}=await import("../hercules-guardian/containment-executor.mjs");
  let calls=0;
  const result=await executeGuardianContainment({
    plan:{status:"AUTHORIZED_PLAN",executionAuthority:false,action:{type:"guardian.containment.isolate",target:"studio-api",scope:"service"},authorizationEvidenceSha256:"d".repeat(64),requiresSeparateExecutor:true},
    adapter:{isolate:async()=>{calls++; return {isolated:true}},rollback:async()=>({restored:true})}
  });
  assert.equal(result.mode,"DRY_RUN");
  assert.equal(result.executed,false);
  assert.equal(calls,0);
});

test("live containment rejects absent explicit execution authority", async () => {
  const {executeGuardianContainment}=await import("../hercules-guardian/containment-executor.mjs");
  await assert.rejects(()=>executeGuardianContainment({
    mode:"LIVE",
    plan:{status:"AUTHORIZED_PLAN",executionAuthority:false,action:{type:"guardian.containment.isolate",target:"studio-api",scope:"service"},authorizationEvidenceSha256:"d".repeat(64),requiresSeparateExecutor:true},
    executionAuthorization:null,
    adapter:{isolate:async()=>({isolated:true}),rollback:async()=>({restored:true})}
  }),/explicit execution authorization is required/);
});

test("live containment is target-bound and requires rollback capability", async () => {
  const {executeGuardianContainment}=await import("../hercules-guardian/containment-executor.mjs");
  await assert.rejects(()=>executeGuardianContainment({
    mode:"LIVE",
    plan:{status:"AUTHORIZED_PLAN",executionAuthority:false,action:{type:"guardian.containment.isolate",target:"studio-api",scope:"service"},authorizationEvidenceSha256:"d".repeat(64),requiresSeparateExecutor:true},
    executionAuthorization:{approved:true,target:"other-api",scope:"service",evidenceSha256:"e".repeat(64)},
    adapter:{isolate:async()=>({isolated:true}),rollback:async()=>({restored:true})}
  }),/execution authorization does not match containment target/);
});


test("post-containment verification returns verified only for matching isolated target", async () => {
  const {verifyGuardianContainment}=await import("../hercules-guardian/post-containment.mjs");
  const result=verifyGuardianContainment({
    execution:{executed:true,action:{target:"studio-api",scope:"service"},evidence:{isolated:true,target:"studio-api",scope:"service"}},
    observation:{isolated:true,target:"studio-api",scope:"service"}
  });
  assert.equal(result.status,"VERIFIED_CONTAINED");
  assert.equal(result.rollbackProposal,null);
});

test("failed post-containment verification emits non-executing rollback proposal", async () => {
  const {verifyGuardianContainment}=await import("../hercules-guardian/post-containment.mjs");
  const result=verifyGuardianContainment({
    execution:{executed:true,action:{target:"studio-api",scope:"service"},evidence:{isolated:true,target:"studio-api",scope:"service"},executionAuthorizationEvidenceSha256:"e".repeat(64)},
    observation:{isolated:false,target:"studio-api",scope:"service"}
  });
  assert.equal(result.status,"CONTAINMENT_UNVERIFIED");
  assert.equal(result.rollbackProposal.required,true);
  assert.equal(result.rollbackProposal.executionAuthority,false);
  assert.equal(result.rollbackProposal.target,"studio-api");
});

test("post-containment verification rejects cross-target evidence", async () => {
  const {verifyGuardianContainment}=await import("../hercules-guardian/post-containment.mjs");
  assert.throws(()=>verifyGuardianContainment({
    execution:{executed:true,action:{target:"studio-api",scope:"service"},evidence:{isolated:true}},
    observation:{isolated:true,target:"other-api",scope:"service"}
  }),/observation does not match containment target/);
});


test("incident ledger creates a verifiable hash-linked event chain", async () => {
  const {createGuardianIncidentLedger,appendGuardianIncidentEvent,verifyGuardianIncidentLedger}=await import("../hercules-guardian/incident-ledger.mjs");
  let ledger=createGuardianIncidentLedger({incidentId:"inc-1",target:"studio-api"});
  ledger=appendGuardianIncidentEvent(ledger,{type:"DRIFT_DETECTED",evidenceSha256:"a".repeat(64)});
  ledger=appendGuardianIncidentEvent(ledger,{type:"CONTAINMENT_PROPOSED",evidenceSha256:"b".repeat(64)});
  const verification=verifyGuardianIncidentLedger(ledger);
  assert.equal(verification.valid,true);
  assert.equal(ledger.events.length,2);
  assert.equal(ledger.events[1].previousEventSha256,ledger.events[0].eventSha256);
});

test("incident ledger detects altered evidence", async () => {
  const {createGuardianIncidentLedger,appendGuardianIncidentEvent,verifyGuardianIncidentLedger}=await import("../hercules-guardian/incident-ledger.mjs");
  let ledger=createGuardianIncidentLedger({incidentId:"inc-1",target:"studio-api"});
  ledger=appendGuardianIncidentEvent(ledger,{type:"DRIFT_DETECTED",evidenceSha256:"a".repeat(64)});
  const tampered=structuredClone(ledger);
  tampered.events[0].evidenceSha256="b".repeat(64);
  assert.equal(verifyGuardianIncidentLedger(tampered).valid,false);
});

test("incident ledger rejects unknown event types and invalid evidence digests", async () => {
  const {createGuardianIncidentLedger,appendGuardianIncidentEvent}=await import("../hercules-guardian/incident-ledger.mjs");
  const ledger=createGuardianIncidentLedger({incidentId:"inc-1",target:"studio-api"});
  assert.throws(()=>appendGuardianIncidentEvent(ledger,{type:"SILENT_MUTATION",evidenceSha256:"a".repeat(64)}),/unsupported Guardian incident event/);
  assert.throws(()=>appendGuardianIncidentEvent(ledger,{type:"DRIFT_DETECTED",evidenceSha256:"nope"}),/valid evidence digest is required/);
});


test("Watchtower opens an incident on verified-state drift without executing containment", async () => {
  const {observeGuardianRuntime}=await import("../hercules-guardian/watchtower.mjs");
  const result=observeGuardianRuntime({
    expected:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:"+"f".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  assert.equal(result.status,"INCIDENT_OPENED");
  assert.equal(result.executionAuthority,false);
  assert.equal(result.incident.events[0].type,"DRIFT_DETECTED");
  assert.equal(result.guardian.verdict,"deny");
});

test("Watchtower returns healthy without opening an incident when state matches", async () => {
  const {observeGuardianRuntime}=await import("../hercules-guardian/watchtower.mjs");
  const state={artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"};
  const result=observeGuardianRuntime({expected:state,observed:state,target:{id:"studio-api",scope:"service"}});
  assert.equal(result.status,"HEALTHY");
  assert.equal(result.incident,null);
});

test("Watchtower deduplicates the same drift fingerprint", async () => {
  const {observeGuardianRuntime}=await import("../hercules-guardian/watchtower.mjs");
  const args={
    expected:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:"+"f".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  };
  const first=observeGuardianRuntime(args);
  const second=observeGuardianRuntime({...args,knownIncidentFingerprints:[first.fingerprint]});
  assert.equal(second.status,"INCIDENT_ALREADY_OPEN");
  assert.equal(second.incident,null);
  assert.equal(second.fingerprint,first.fingerprint);
});


test("Watchtower registry rejects duplicate service identities", async () => {
  const {createWatchtowerRegistry}=await import("../hercules-guardian/watchtower-registry.mjs");
  const baseline={artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"};
  assert.throws(()=>createWatchtowerRegistry([
    {id:"studio",scope:"service",baseline,observe:async()=>baseline},
    {id:"studio",scope:"service",baseline,observe:async()=>baseline}
  ]),/duplicate Watchtower service id/);
});

test("Watchtower cycle isolates observation failures per service", async () => {
  const {createWatchtowerRegistry,runWatchtowerCycle}=await import("../hercules-guardian/watchtower-registry.mjs");
  const healthy={artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"};
  const registry=createWatchtowerRegistry([
    {id:"studio",scope:"service",baseline:healthy,observe:async()=>healthy},
    {id:"forge",scope:"service",baseline:{...healthy,identity:"svc-forge"},observe:async()=>{throw new Error("provider unavailable")}}
  ]);
  const cycle=await runWatchtowerCycle(registry);
  assert.equal(cycle.results.find(x=>x.id==="studio").status,"HEALTHY");
  assert.equal(cycle.results.find(x=>x.id==="forge").status,"OBSERVATION_FAILED");
  assert.equal(cycle.executionAuthority,false);
});

test("Watchtower cycle carries incident fingerprints forward for deduplication", async () => {
  const {createWatchtowerRegistry,runWatchtowerCycle}=await import("../hercules-guardian/watchtower-registry.mjs");
  const baseline={artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"};
  const drift={...baseline,artifact:"sha256:"+"f".repeat(64)};
  const registry=createWatchtowerRegistry([{id:"studio",scope:"service",baseline,observe:async()=>drift}]);
  const first=await runWatchtowerCycle(registry);
  const second=await runWatchtowerCycle(registry,{knownIncidentFingerprints:first.incidentFingerprints});
  assert.equal(first.results[0].status,"INCIDENT_OPENED");
  assert.equal(second.results[0].status,"INCIDENT_ALREADY_OPEN");
});


test("Watchtower scheduler prevents overlapping cycles", async () => {
  const {createWatchtowerScheduler}=await import("../hercules-guardian/watchtower-scheduler.mjs");
  let release;
  const scheduler=createWatchtowerScheduler({
    runCycle:()=>new Promise(resolve=>{release=()=>resolve({status:"HEALTHY"})})
  });
  const first=scheduler.tick();
  const second=await scheduler.tick();
  assert.equal(second.status,"SKIPPED_OVERLAP");
  release();
  assert.equal((await first).status,"HEALTHY");
});


test("Hercules service catalog registers owned services with explicit evidence readers", async () => {
  const {createHerculesGuardianCatalog}=await import("../hercules-guardian/hercules-service-catalog.mjs");
  const baseline={artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc",policy:"policy-v1"};
  const catalog=createHerculesGuardianCatalog({
    baselines:{studio:baseline,forge:{...baseline,identity:"forge"},deploy:{...baseline,identity:"deploy"},cleaner:{...baseline,identity:"cleaner"},runtime:{...baseline,identity:"runtime"}},
    observers:{
      studio:async()=>baseline,forge:async()=>({...baseline,identity:"forge"}),deploy:async()=>({...baseline,identity:"deploy"}),
      cleaner:async()=>({...baseline,identity:"cleaner"}),runtime:async()=>({...baseline,identity:"runtime"})
    }
  });
  assert.deepEqual(catalog.map(x=>x.id),["studio","forge","deploy","cleaner","runtime"]);
});

test("Hercules service catalog fails closed when an observer is missing", async () => {
  const {createHerculesGuardianCatalog}=await import("../hercules-guardian/hercules-service-catalog.mjs");
  assert.throws(()=>createHerculesGuardianCatalog({baselines:{},observers:{}}),/baseline is required|observer is required/);
});
