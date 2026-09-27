import test from "node:test";
import assert from "node:assert/strict";

import {
  qualifyFinancialProductionAdapters,
  validateProviderQualificationAdapter,
} from "../hercules-bank/adapter-qualification.mjs";

function store(overrides={}){
  return {
    id:"pg-main",
    environment:"production",
    withTransaction:async(fn)=>fn({qualification:true}),
    healthCheck:async()=>({ok:true}),
    createBackup:async()=>({id:"backup-qualification-1"}),
    verifyRestore:async({backup})=>({ok:backup.id==="backup-qualification-1",isolated:true}),
    ...overrides,
  };
}

function custody(overrides={}){
  return {
    providerId:"kms-main",
    environment:"production",
    signDigest:async(digest)=>Buffer.from(digest),
    describeKey:async()=>({keyId:"key-1",exportable:false,rotationEnabled:true}),
    rotateKey:async()=>({keyId:"key-2"}),
    ...overrides,
  };
}

function provider(overrides={}){
  return {
    providerId:"sponsor-adapter",
    environment:"production",
    endpoint:"https://provider.example.test",
    healthCheck:async()=>({ok:true}),
    describeCapabilities:async()=>({
      externalMoneyMovement:true,
      custodialDeposits:true,
      sandboxOrDryRun:true,
    }),
    ...overrides,
  };
}

test("production qualification rejects non-production infrastructure adapters",async()=>{
  const result=await qualifyFinancialProductionAdapters({
    transactionalStore:store({environment:"sandbox"}),
    secretCustody:custody(),
    regulatedProvider:provider(),
  });

  assert.equal(result.qualified,false);
  assert.match(result.blockers.join("\n"),/transactionalStore.*production/i);
  assert.equal(result.activationAllowed,false);
  assert.equal(result.externalRailsEnabled,false);
});

test("transactional store qualification proves health transaction backup and isolated restore",async()=>{
  const result=await qualifyFinancialProductionAdapters({
    transactionalStore:store(),
    secretCustody:custody(),
    regulatedProvider:provider(),
  });

  assert.equal(result.checks.transactionalStore.qualified,true);
  assert.equal(result.checks.transactionalStore.health,true);
  assert.equal(result.checks.transactionalStore.transactionRoundTrip,true);
  assert.equal(result.checks.transactionalStore.backupCreated,true);
  assert.equal(result.checks.transactionalStore.restoreVerified,true);
});

test("transactional store qualification fails when restore is not explicitly isolated",async()=>{
  const result=await qualifyFinancialProductionAdapters({
    transactionalStore:store({verifyRestore:async()=>({ok:true,isolated:false})}),
    secretCustody:custody(),
    regulatedProvider:provider(),
  });

  assert.equal(result.qualified,false);
  assert.match(result.blockers.join("\n"),/restore.*isolated/i);
});

test("key custody qualification proves non-exportability rotation metadata and signing",async()=>{
  const result=await qualifyFinancialProductionAdapters({
    transactionalStore:store(),
    secretCustody:custody(),
    regulatedProvider:provider(),
  });

  assert.equal(result.checks.secretCustody.qualified,true);
  assert.equal(result.checks.secretCustody.nonExportable,true);
  assert.equal(result.checks.secretCustody.rotationEnabled,true);
  assert.equal(result.checks.secretCustody.signingVerified,true);
  assert.equal(result.checks.secretCustody.keyId,"key-1");
});

test("key custody qualification fails if provider reports exportable key material",async()=>{
  const result=await qualifyFinancialProductionAdapters({
    transactionalStore:store(),
    secretCustody:custody({describeKey:async()=>({keyId:"key-1",exportable:true,rotationEnabled:true})}),
    regulatedProvider:provider(),
  });

  assert.equal(result.qualified,false);
  assert.match(result.blockers.join("\n"),/non-exportable/i);
});

test("provider qualification adapter requires HTTPS production endpoint and read-only capability probes",()=>{
  assert.throws(()=>validateProviderQualificationAdapter({
    providerId:"bad",
    environment:"production",
    endpoint:"http://provider.example.test",
    healthCheck:async()=>({ok:true}),
    describeCapabilities:async()=>({}),
  }),/HTTPS/i);

  const validated=validateProviderQualificationAdapter(provider());
  assert.equal(validated.providerId,"sponsor-adapter");
  assert.equal("submitTransfer" in validated,false);
});

test("provider qualification is read-only and requires a dry-run or sandbox capability",async()=>{
  let submitted=false;
  const candidate={
    ...provider({
      describeCapabilities:async()=>({
        externalMoneyMovement:true,
        custodialDeposits:true,
        sandboxOrDryRun:false,
      }),
    }),
    submitTransfer:async()=>{submitted=true;},
  };

  const result=await qualifyFinancialProductionAdapters({
    transactionalStore:store(),
    secretCustody:custody(),
    regulatedProvider:candidate,
  });

  assert.equal(submitted,false);
  assert.equal(result.qualified,false);
  assert.match(result.blockers.join("\n"),/dry-run|sandbox/i);
});

test("all candidate adapters can qualify while live-money activation remains impossible",async()=>{
  const result=await qualifyFinancialProductionAdapters({
    transactionalStore:store(),
    secretCustody:custody(),
    regulatedProvider:provider(),
  });

  assert.equal(result.qualified,true);
  assert.deepEqual(result.blockers,[]);
  assert.equal(result.activationAllowed,false);
  assert.equal(result.externalRailsEnabled,false);
  assert.equal("rotateKeyCalled" in result,false);
});
