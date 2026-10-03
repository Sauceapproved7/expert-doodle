import test from "node:test";
import assert from "node:assert/strict";
import {createTrustedReleaseTruthOperator} from "../sauceapproved-studio/release-truth/trusted-operator.mjs";

const evidence={systemId:"studio-global-closure",verified:true,current:true,artifactSha256:"f".repeat(64),source:"artifact",recordedAt:"2026-10-01T06:30:00Z",actorId:"owner"};

test("trusted operator records evidence only after explicit authorization",async()=>{
 const calls=[];
 const operator=createTrustedReleaseTruthOperator({
  authorize:async request=>{calls.push(request);return request.trusted===true;},
  ledger:{record:async entry=>entry,revoke:async entry=>entry}
 });
 await assert.rejects(()=>operator.record({trusted:false},evidence),/release_truth_operator_authorization_required/);
 assert.equal(calls.length,1);
 const receipt=await operator.record({trusted:true},evidence);
 assert.equal(receipt.systemId,evidence.systemId);
});

test("trusted operator exposes no public-http mutation capability",()=>{
 const operator=createTrustedReleaseTruthOperator({authorize:async()=>true,ledger:{record:async x=>x,revoke:async x=>x}});
 assert.equal(operator.publicHttpMutationAllowed,false);
 assert.equal(operator.mutationPolicy,"trusted-operator-only");
});
