import test from "node:test";
import assert from "node:assert/strict";
import {createReleaseTruthEvidenceStore} from "../sauceapproved-studio/release-truth/evidence-store.mjs";

test("release truth evidence store fails closed until real current evidence exists",()=>{
 const store=createReleaseTruthEvidenceStore();
 const status=store.status();
 assert.equal(status.releaseReady,false);
 assert.equal(status.syntheticEvidenceAllowed,false);
 assert.ok(status.blockedSystemIds.length>0);
});

test("release truth rejects synthetic or malformed evidence",()=>{
 const store=createReleaseTruthEvidenceStore();
 assert.throws(()=>store.record({systemId:"studio-global-closure",verified:true,current:true,artifactSha256:"0".repeat(64),source:"synthetic"}),/real_evidence_required/);
});
