import test from "node:test";
import assert from "node:assert/strict";
import {createReleaseTruthEvidenceStore} from "../sauceapproved-studio/release-truth/evidence-store.mjs";

test("hydration rejects sentinel all-zero artifact hashes even when injected directly",()=>{
 const store=createReleaseTruthEvidenceStore({initialEvidence:{
  "studio-global-closure":{verified:true,current:true,artifactSha256:"0".repeat(64),source:"artifact"}
 }});
 const status=store.status();
 assert.equal(status.releaseReady,false);
 assert.ok(status.blockedSystemIds.includes("studio-global-closure"));
});
