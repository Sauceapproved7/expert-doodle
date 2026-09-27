import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign,verify} from "node:crypto";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {
  HerculesQualificationEvidenceStore,
  qualificationIdentityFingerprint,
} from "../hercules-bank/qualification-evidence.mjs";

function qualification(overrides={}){
  return {
    qualified:true,
    activationAllowed:false,
    externalRailsEnabled:false,
    blockers:[],
    checks:{
      transactionalStore:{qualified:true,id:"pg-main",environment:"production",health:true,transactionRoundTrip:true,backupCreated:true,restoreVerified:true},
      secretCustody:{qualified:true,providerId:"kms-main",environment:"production",keyId:"key-1",nonExportable:true,rotationEnabled:true,signingVerified:true},
      regulatedProvider:{qualified:true,providerId:"sponsor-1",environment:"production",endpoint:"https://provider.example.test",health:true,externalMoneyMovement:true,custodialDeposits:true,sandboxOrDryRun:true,submissionTested:false},
    },
    ...overrides,
  };
}

function cryptoAdapters(){
  const {publicKey,privateKey}=generateKeyPairSync("ed25519");
  return {
    signer:{
      keyId:"qualification-signing-key-1",
      signDigest:async(digest)=>sign(null,digest,privateKey),
    },
    verifier:{
      verifyDigest:async({keyId,digest,signature})=>{
        assert.equal(keyId,"qualification-signing-key-1");
        return verify(null,digest,publicKey,signature);
      },
    },
  };
}

test("qualification identity fingerprint changes when store key or provider identity changes",()=>{
  const base=qualification();
  const a=qualificationIdentityFingerprint(base);
  const b=qualificationIdentityFingerprint(qualification({
    checks:{...base.checks,secretCustody:{...base.checks.secretCustody,keyId:"key-2"}},
  }));
  const c=qualificationIdentityFingerprint(qualification({
    checks:{...base.checks,regulatedProvider:{...base.checks.regulatedProvider,providerId:"sponsor-2"}},
  }));
  assert.notEqual(a,b);
  assert.notEqual(a,c);
});

test("qualification evidence persists signed bounded evidence and reopens cleanly",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-qualification-"));
  const statePath=join(root,"qualification.json");
  const {signer,verifier}=cryptoAdapters();
  try{
    const store=await HerculesQualificationEvidenceStore.open({statePath,verifier});
    const record=await store.recordQualification({
      qualification:qualification(),
      signer,
      qualifiedAt:"2026-09-27T08:00:00Z",
      ttlHours:168,
    });
    assert.equal(record.activationAllowed,false);
    assert.equal(record.externalRailsEnabled,false);
    assert.equal(record.signerKeyId,"qualification-signing-key-1");
    assert.equal("signDigest" in record,false);

    const reopened=await HerculesQualificationEvidenceStore.open({statePath,verifier});
    const status=await reopened.status({
      currentQualification:qualification(),
      now:"2026-09-28T08:00:00Z",
    });
    assert.equal(status.ready,true);
    assert.equal(status.stale,false);
    assert.equal(status.identityChanged,false);
    assert.equal(status.activationAllowed,false);
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test("stale qualification evidence automatically downgrades readiness",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-qualification-"));
  const {signer,verifier}=cryptoAdapters();
  try{
    const store=await HerculesQualificationEvidenceStore.open({statePath:join(root,"q.json"),verifier});
    await store.recordQualification({
      qualification:qualification(),
      signer,
      qualifiedAt:"2026-09-01T00:00:00Z",
      ttlHours:24,
    });
    const status=await store.status({
      currentQualification:qualification(),
      now:"2026-09-27T08:00:00Z",
    });
    assert.equal(status.ready,false);
    assert.equal(status.stale,true);
    assert.match(status.blockers.join("\n"),/stale|expired/i);
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test("adapter key or provider change requires requalification",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-qualification-"));
  const {signer,verifier}=cryptoAdapters();
  try{
    const store=await HerculesQualificationEvidenceStore.open({statePath:join(root,"q.json"),verifier});
    await store.recordQualification({
      qualification:qualification(),
      signer,
      qualifiedAt:"2026-09-27T08:00:00Z",
      ttlHours:168,
    });
    const changed=qualification();
    changed.checks.secretCustody={...changed.checks.secretCustody,keyId:"key-2"};
    const status=await store.status({
      currentQualification:changed,
      now:"2026-09-27T09:00:00Z",
    });
    assert.equal(status.ready,false);
    assert.equal(status.identityChanged,true);
    assert.match(status.blockers.join("\n"),/requalification/i);
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test("tampered signed qualification evidence fails closed on reopen",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-qualification-"));
  const statePath=join(root,"q.json");
  const {signer,verifier}=cryptoAdapters();
  try{
    const store=await HerculesQualificationEvidenceStore.open({statePath,verifier});
    await store.recordQualification({
      qualification:qualification(),
      signer,
      qualifiedAt:"2026-09-27T08:00:00Z",
      ttlHours:168,
    });
    const snapshot=JSON.parse(await readFile(statePath,"utf8"));
    snapshot.records[0].expiresAt="2030-01-01T00:00:00Z";
    await writeFile(statePath,JSON.stringify(snapshot));
    await assert.rejects(
      ()=>HerculesQualificationEvidenceStore.open({statePath,verifier}),
      /signature|integrity|hash/i,
    );
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});
