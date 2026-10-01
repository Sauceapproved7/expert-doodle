import test from "node:test";
import assert from "node:assert/strict";
import {createReleaseTruthEvidenceLedger,verifyReleaseTruthEvidenceChain} from "../sauceapproved-studio/release-truth/evidence-ledger.mjs";

const entry={systemId:"studio-global-closure",verified:true,current:true,artifactSha256:"e".repeat(64),source:"artifact",recordedAt:"2026-10-01T06:30:00Z",actorId:"owner"};

test("receipt chain verifies intact history",()=>{
 const backing=[]; const ledger=createReleaseTruthEvidenceLedger({backing});
 ledger.record(entry); ledger.revoke({systemId:entry.systemId,actorId:"owner",reason:"superseded",recordedAt:"2026-10-01T06:31:00Z"});
 assert.deepEqual(verifyReleaseTruthEvidenceChain(backing),{valid:true,receiptCount:2,error:null});
});

test("receipt chain fails closed on mutation",()=>{
 const backing=[]; const ledger=createReleaseTruthEvidenceLedger({backing}); ledger.record(entry);
 backing[0]={...backing[0],source:"measurement"};
 const result=verifyReleaseTruthEvidenceChain(backing);
 assert.equal(result.valid,false); assert.equal(result.error,"receipt_hash_mismatch");
});

test("receipt chain fails closed on reordering or missing sequence",()=>{
 const backing=[]; const ledger=createReleaseTruthEvidenceLedger({backing});
 ledger.record(entry); ledger.revoke({systemId:entry.systemId,actorId:"owner",reason:"superseded",recordedAt:"2026-10-01T06:31:00Z"});
 assert.equal(verifyReleaseTruthEvidenceChain([backing[1],backing[0]]).valid,false);
 assert.equal(verifyReleaseTruthEvidenceChain([backing[1]]).valid,false);
});
