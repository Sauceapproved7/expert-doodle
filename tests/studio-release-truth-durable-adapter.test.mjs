import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createDurableReleaseTruthAdapter} from "../sauceapproved-studio/release-truth/durable-adapter.mjs";

test("durable adapter persists append-only receipts across adapter instances",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"hercules-release-truth-"));
 const path=join(dir,"ledger.jsonl");
 const a=await createDurableReleaseTruthAdapter({path});
 await a.append({receiptSha256:"a".repeat(64),sequence:1,type:"evidence"});
 const b=await createDurableReleaseTruthAdapter({path});
 assert.equal((await b.load()).length,1);
 assert.equal((await b.load())[0].receiptSha256,"a".repeat(64));
});

test("durable adapter refuses to overwrite existing ledger history",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"hercules-release-truth-"));
 const path=join(dir,"ledger.jsonl");
 const adapter=await createDurableReleaseTruthAdapter({path});
 await adapter.append({receiptSha256:"b".repeat(64),sequence:1,type:"evidence"});
 const before=await readFile(path,"utf8");
 await adapter.append({receiptSha256:"c".repeat(64),sequence:2,type:"revocation"});
 const after=await readFile(path,"utf8");
 assert.ok(after.startsWith(before));
 assert.equal((await adapter.load()).length,2);
});
