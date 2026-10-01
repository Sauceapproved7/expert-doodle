import test from "node:test";
import assert from "node:assert/strict";
import {createCanonicalWatchtowerRuntime} from "../hercules-guardian/canonical-watchtower-runtime.mjs";

function catalogFactory(){
 const healthy={artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc",policy:"policy-v1"};
 return Promise.resolve(Object.freeze([
  Object.freeze({id:"studio",scope:"service",baseline:healthy,observe:async()=>healthy}),
  Object.freeze({id:"forge",scope:"service",baseline:{...healthy,identity:"forge"},observe:async()=>({...healthy,identity:"forge"})}),
  Object.freeze({id:"deploy",scope:"control-plane",baseline:{...healthy,identity:"deploy"},observe:async()=>({...healthy,identity:"deploy"})}),
  Object.freeze({id:"cleaner",scope:"device-service",baseline:{...healthy,identity:"cleaner"},observe:async()=>({...healthy,identity:"cleaner"})}),
  Object.freeze({id:"runtime",scope:"control-plane",baseline:{...healthy,identity:"runtime"},observe:async()=>({...healthy,identity:"runtime"})})
 ]));
}

test("operational runtime fails closed before first completed cycle",async()=>{
 const runtime=await createCanonicalWatchtowerRuntime({catalogFactory,intervalMs:1000});
 await assert.rejects(()=>runtime.readStatus(),/cycle has not completed/);
 assert.equal(runtime.executionAuthority,false);
});

test("manual Watchtower tick publishes read-only five-domain status",async()=>{
 const runtime=await createCanonicalWatchtowerRuntime({catalogFactory,intervalMs:1000});
 const cycle=await runtime.tick();
 const status=await runtime.readStatus();
 assert.equal(cycle.status,"HEALTHY");
 assert.equal(status.status,"HEALTHY");
 assert.deepEqual(status.results.map(x=>x.id),["studio","forge","deploy","cleaner","runtime"]);
 assert.equal(status.executionAuthority,false);
 assert.equal(runtime.executionAuthority,false);
 runtime.stop();
});

test("runtime retains incident fingerprints between cycles",async()=>{
 let drift=true;
 const baseline={artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc",policy:"policy-v1"};
 const factory=async()=>Object.freeze([
  Object.freeze({id:"studio",scope:"service",baseline,observe:async()=>drift?{...baseline,artifact:"sha256:"+"f".repeat(64)}:baseline})
 ]);
 const runtime=await createCanonicalWatchtowerRuntime({catalogFactory:factory,intervalMs:1000});
 const first=await runtime.tick();
 const second=await runtime.tick();
 assert.equal(first.results[0].status,"INCIDENT_OPENED");
 assert.equal(second.results[0].status,"INCIDENT_ALREADY_OPEN");
 assert.deepEqual(second.incidentFingerprints,first.incidentFingerprints);
 assert.equal(second.executionAuthority,false);
 runtime.stop();
});

test("runtime does not expose containment execution",async()=>{
 const runtime=await createCanonicalWatchtowerRuntime({catalogFactory,intervalMs:1000});
 assert.equal("executeContainment" in runtime,false);
 assert.equal("isolate" in runtime,false);
 runtime.stop();
});
