import test from "node:test";
import assert from "node:assert/strict";
import {createReleaseTruthEvidenceLedger} from "../sauceapproved-studio/release-truth/evidence-ledger.mjs";

test("release truth ledger is append-only and survives store re-instantiation",()=>{
 const backing=[];
 const a=createReleaseTruthEvidenceLedger({backing});
 const receipt=a.record({systemId:"studio-global-closure",verified:true,current:true,artifactSha256:"a".repeat(64),source:"artifact",recordedAt:"2026-10-01T04:15:00Z",actorId:"owner"});
 assert.equal(receipt.sequence,1);
 const b=createReleaseTruthEvidenceLedger({backing});
 assert.equal(b.history().length,1);
 assert.equal(b.history()[0].receiptSha256,receipt.receiptSha256);
});

test("release truth ledger rejects sentinel hashes and missing identity or timestamp",()=>{
 const ledger=createReleaseTruthEvidenceLedger({backing:[]});
 assert.throws(()=>ledger.record({systemId:"studio-global-closure",verified:true,current:true,artifactSha256:"0".repeat(64),source:"artifact",recordedAt:"2026-10-01T04:15:00Z",actorId:"owner"}),/sentinel_hash_rejected/);
 assert.throws(()=>ledger.record({systemId:"studio-global-closure",verified:true,current:true,artifactSha256:"a".repeat(64),source:"artifact"}),/evidence_identity_and_timestamp_required/);
});

test("revocation appends a receipt instead of deleting history",()=>{
 const ledger=createReleaseTruthEvidenceLedger({backing:[]});
 ledger.record({systemId:"studio-global-closure",verified:true,current:true,artifactSha256:"b".repeat(64),source:"artifact",recordedAt:"2026-10-01T04:15:00Z",actorId:"owner"});
 ledger.revoke({systemId:"studio-global-closure",recordedAt:"2026-10-01T04:16:00Z",actorId:"owner",reason:"superseded"});
 assert.equal(ledger.history().length,2);
 assert.equal(ledger.currentEvidence()["studio-global-closure"],undefined);
});
