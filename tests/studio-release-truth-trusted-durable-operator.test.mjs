import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createTrustedDurableReleaseTruthOperator} from "../sauceapproved-studio/release-truth/trusted-durable-operator.mjs";

const evidence={systemId:"studio-global-closure",verified:true,current:true,artifactSha256:"1".repeat(64),source:"artifact",recordedAt:"2026-10-01T06:45:00Z",actorId:"owner"};

test("trusted durable operator persists authorized evidence across lifecycle",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"hercules-operator-"));
 const path=join(dir,"ledger.jsonl");
 const authorize=async request=>request.actorId==="owner";
 const a=await createTrustedDurableReleaseTruthOperator({path,authorize});
 await a.record({actorId:"owner"},evidence);
 const b=await createTrustedDurableReleaseTruthOperator({path,authorize});
 assert.equal(b.history().length,1);
 assert.equal(b.currentEvidence()["studio-global-closure"].artifactSha256,"1".repeat(64));
 assert.equal(b.publicHttpMutationAllowed,false);
});

test("trusted durable operator rejects unauthorized mutation before durable write",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"hercules-operator-"));
 const path=join(dir,"ledger.jsonl");
 const operator=await createTrustedDurableReleaseTruthOperator({path,authorize:async()=>false});
 await assert.rejects(()=>operator.record({actorId:"intruder"},evidence),/release_truth_operator_authorization_required/);
 assert.equal(operator.history().length,0);
});
