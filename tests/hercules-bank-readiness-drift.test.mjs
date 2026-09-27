import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {HerculesReadinessDriftSentinel} from "../hercules-bank/readiness-drift.mjs";

function dossier({ready=true,blockers=[],adapter={ready:true,stale:false,identityChanged:false,expiresAt:"2026-10-04T08:00:00Z"},store=true}={}){
  return {
    ready,
    activationAllowed:false,
    externalRailsEnabled:false,
    blockers,
    controls:{
      regulatedMoney:{ready:true},
      transactionalStore:{ready:store},
      secretCustody:{ready:true},
      recovery:{ready:true},
      caseOperations:{ready:true},
      providerCertification:{certified:true},
      adapterQualification:adapter,
    },
  };
}

test("readiness drift sentinel establishes a clean baseline without granting activation",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-drift-"));
  try{
    const sentinel=await HerculesReadinessDriftSentinel.open({statePath:join(root,"drift.json")});
    const result=await sentinel.check({dossier:dossier(),now:"2026-09-27T08:00:00Z"});
    assert.equal(result.regressed,false);
    assert.deepEqual(result.findings,[]);
    assert.equal(result.activationAllowed,false);
    assert.equal(result.externalRailsEnabled,false);
  }finally{await rm(root,{recursive:true,force:true})}
});

test("previously green readiness falling blocked is a critical regression",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-drift-"));
  try{
    const sentinel=await HerculesReadinessDriftSentinel.open({statePath:join(root,"drift.json")});
    await sentinel.check({dossier:dossier(),now:"2026-09-27T08:00:00Z"});
    const result=await sentinel.check({
      dossier:dossier({ready:false,blockers:["transactionalStore: health failed"],store:false}),
      now:"2026-09-27T09:00:00Z",
    });
    assert.equal(result.regressed,true);
    assert.ok(result.findings.some((x)=>x.code==="readiness_regression"&&x.severity==="critical"));
    assert.ok(result.findings.some((x)=>x.code==="control_regression:transactionalStore"));
    assert.equal(result.activationAllowed,false);
  }finally{await rm(root,{recursive:true,force:true})}
});

test("qualification evidence approaching expiry emits warning before it becomes stale",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-drift-"));
  try{
    const sentinel=await HerculesReadinessDriftSentinel.open({statePath:join(root,"drift.json")});
    const result=await sentinel.check({
      dossier:dossier({adapter:{ready:true,stale:false,identityChanged:false,expiresAt:"2026-09-28T08:00:00Z"}}),
      now:"2026-09-27T08:00:00Z",
      warningHours:48,
    });
    assert.ok(result.findings.some((x)=>x.code==="qualification_expiry_warning"&&x.severity==="warning"));
    assert.equal(result.regressed,false);
  }finally{await rm(root,{recursive:true,force:true})}
});

test("stale or identity-changed qualification evidence is critical",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-drift-"));
  try{
    const sentinel=await HerculesReadinessDriftSentinel.open({statePath:join(root,"drift.json")});
    const result=await sentinel.check({
      dossier:dossier({ready:false,adapter:{ready:false,stale:true,identityChanged:true,expiresAt:"2026-09-26T08:00:00Z"}}),
      now:"2026-09-27T08:00:00Z",
    });
    assert.ok(result.findings.some((x)=>x.code==="qualification_stale"&&x.severity==="critical"));
    assert.ok(result.findings.some((x)=>x.code==="qualification_identity_changed"&&x.severity==="critical"));
  }finally{await rm(root,{recursive:true,force:true})}
});

test("tampering with persisted drift history fails closed",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-drift-"));
  const statePath=join(root,"drift.json");
  try{
    const sentinel=await HerculesReadinessDriftSentinel.open({statePath});
    await sentinel.check({dossier:dossier(),now:"2026-09-27T08:00:00Z"});
    const snapshot=JSON.parse(await readFile(statePath,"utf8"));
    snapshot.events[0].snapshot.ready=false;
    await writeFile(statePath,JSON.stringify(snapshot));
    await assert.rejects(()=>HerculesReadinessDriftSentinel.open({statePath}),/hash|integrity/i);
  }finally{await rm(root,{recursive:true,force:true})}
});

test("sentinel rejects dossiers that claim live-money authority",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-drift-"));
  try{
    const sentinel=await HerculesReadinessDriftSentinel.open({statePath:join(root,"drift.json")});
    const unsafe=dossier();unsafe.activationAllowed=true;
    await assert.rejects(()=>sentinel.check({dossier:unsafe,now:"2026-09-27T08:00:00Z"}),/activation|locked/i);
  }finally{await rm(root,{recursive:true,force:true})}
});
