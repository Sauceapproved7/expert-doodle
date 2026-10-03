import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createDurableReleaseTruthLedger} from "../sauceapproved-studio/release-truth/durable-ledger.mjs";

const evidence={systemId:"studio-global-closure",verified:true,current:true,artifactSha256:"d".repeat(64),source:"artifact",recordedAt:"2026-10-01T05:00:00Z",actorId:"owner"};

test("durable ledger restores receipts and current evidence across instances",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"hercules-release-truth-"));
 const path=join(dir,"ledger.jsonl");
 const a=await createDurableReleaseTruthLedger({path});
 await a.record(evidence);
 const b=await createDurableReleaseTruthLedger({path});
 assert.equal(b.history().length,1);
 assert.equal(b.currentEvidence()["studio-global-closure"].artifactSha256,"d".repeat(64));
});

test("durable ledger fails closed when durable storage cannot initialize",async()=>{
 await assert.rejects(()=>createDurableReleaseTruthLedger({path:"/dev/null/ledger.jsonl"}),/release_truth_durable_storage_unavailable/);
});
