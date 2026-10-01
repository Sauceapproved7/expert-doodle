import test from "node:test";
import assert from "node:assert/strict";
import {createCleanerReleaseProof} from "../hercules-guardian/cleaner-release-proof.mjs";

const release={schema:"sauceapproved.hercules.cleaner.package.v1",product:"Hercules Cleaner",version:"1.0.0",canonicalRepository:"Sauceapproved7/expert-doodle",sourceCommit:"77093aceae5d5df5a3ae4d3947b607473ff15db9",aggregateSha256:"a".repeat(64),files:[{path:"hercules-cleaner/engine.mjs",sha256:"b".repeat(64),bytes:10}]};

test("Cleaner proof binds immutable release, recovery and rollback identities",()=>{
 const proof=createCleanerReleaseProof({release,installation:{sourceCommit:release.sourceCommit,aggregateSha256:release.aggregateSha256,recoveryCapsulePreserved:true,rollbackIdentity:release.sourceCommit}});
 assert.equal(proof.identity,"cleaner:1.0.0:"+release.sourceCommit);
 assert.equal(proof.policy,"guardian-cleaner-release-v1");
 assert.equal(proof.executionAuthority,false);
});
test("Cleaner proof fails closed on release or recovery drift",()=>{
 assert.throws(()=>createCleanerReleaseProof({release,installation:{sourceCommit:"c".repeat(40),aggregateSha256:release.aggregateSha256,recoveryCapsulePreserved:true,rollbackIdentity:release.sourceCommit}}),/source commit mismatch/);
 assert.throws(()=>createCleanerReleaseProof({release,installation:{sourceCommit:release.sourceCommit,aggregateSha256:release.aggregateSha256,recoveryCapsulePreserved:false,rollbackIdentity:release.sourceCommit}}),/Recovery Capsule preservation required/);
});
