import test from "node:test";
import assert from "node:assert/strict";

import {
  validateTransactionalFinancialStoreAdapter,
  validateSecretCustodyAdapter,
} from "../hercules-bank/production-readiness.mjs";

test("production readiness contracts reject non-production store environments",()=>{
  assert.throws(()=>validateTransactionalFinancialStoreAdapter({
    id:"pg-candidate",
    environment:"sandbox",
    withTransaction:async()=>{},
    healthCheck:async()=>({ok:true}),
    createBackup:async()=>({id:"backup"}),
    verifyRestore:async()=>({ok:true}),
  }),/production/i);
});

test("production readiness contracts reject non-production key-custody environments",()=>{
  assert.throws(()=>validateSecretCustodyAdapter({
    providerId:"kms-candidate",
    environment:"sandbox",
    signDigest:async()=>Buffer.alloc(64),
    describeKey:async()=>({}),
    rotateKey:async()=>({}),
  }),/production/i);
});
