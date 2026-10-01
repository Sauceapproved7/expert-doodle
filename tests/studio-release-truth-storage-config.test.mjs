import test from "node:test";
import assert from "node:assert/strict";
import {resolveReleaseTruthStorageConfig} from "../sauceapproved-studio/release-truth/storage-config.mjs";

test("production Release Truth storage fails closed without an explicitly durable mount",()=>{
 assert.throws(()=>resolveReleaseTruthStorageConfig({environment:"production",path:"/tmp/release-truth.jsonl",durableMountVerified:false}),/release_truth_durable_mount_required/);
});

test("production Release Truth storage accepts only explicitly verified durable path",()=>{
 const config=resolveReleaseTruthStorageConfig({environment:"production",path:"/var/lib/hercules/release-truth/ledger.jsonl",durableMountVerified:true});
 assert.equal(config.durable,true);
 assert.equal(config.verifiedMount,true);
 assert.equal(config.path,"/var/lib/hercules/release-truth/ledger.jsonl");
});

test("non-production storage is never mislabeled production durable",()=>{
 const config=resolveReleaseTruthStorageConfig({environment:"test",path:"/tmp/release-truth.jsonl",durableMountVerified:false});
 assert.equal(config.durable,false);
 assert.equal(config.verifiedMount,false);
});
