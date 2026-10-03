import test from "node:test";
import assert from "node:assert/strict";
import {createAuthorizedReleaseTruthBridge} from "../sauceapproved-studio/release-truth/authorized-bridge.mjs";

const evidence={systemId:"studio-global-closure",verified:true,current:true,artifactSha256:"c".repeat(64),source:"artifact",recordedAt:"2026-10-01T04:20:00Z",actorId:"owner"};

test("Release Truth mutation requires explicit trusted authorization",async()=>{
 const bridge=createAuthorizedReleaseTruthBridge({authorize:async()=>false,backing:[]});
 await assert.rejects(()=>bridge.record({request:{},evidence}),/release_truth_authorization_required/);
 assert.equal(bridge.status().historyCount,0);
});

test("authorized Release Truth mutation records through append-only ledger",async()=>{
 const backing=[];
 const bridge=createAuthorizedReleaseTruthBridge({authorize:async()=>true,backing});
 const receipt=await bridge.record({request:{actor:"owner"},evidence});
 assert.equal(receipt.type,"evidence");
 assert.equal(bridge.status().historyCount,1);
 assert.equal(bridge.status().currentEvidence["studio-global-closure"].artifactSha256,"c".repeat(64));
});
