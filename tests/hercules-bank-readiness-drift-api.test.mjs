import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {createHerculesBankApi} from "../hercules-bank/api.mjs";
import {HerculesBankRuntime} from "../hercules-bank/runtime.mjs";
import {HerculesComplianceOperations} from "../hercules-bank/compliance-operations.mjs";

const SECRET=Buffer.alloc(48,95).toString("hex");
const owner=()=>signJwtHs256({sub:"owner-1",role:"owner",issuer:"hercules-base",audience:"hercules-base-api",ttlSeconds:900,nowSeconds:1000},SECRET);

test("readiness drift route is owner-only and consumes sanitized current dossier",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-drift-api-"));
  let server=null;let calls=0;
  try{
    const runtime=await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const complianceOperations=await HerculesComplianceOperations.open({statePath:join(root,"compliance.json")});
    const readinessDriftSentinel={
      check:async({dossier,now})=>{
        calls+=1;
        assert.equal(dossier.activationAllowed,false);
        assert.equal(dossier.externalRailsEnabled,false);
        assert.equal(now,"1970-01-01T00:18:20.000Z");
        return {regressed:true,findings:[{code:"readiness_regression",severity:"critical"}],activationAllowed:false,externalRailsEnabled:false};
      },
    };
    server=createHerculesBankApi({runtime,complianceOperations,readinessDriftSentinel,jwtSecret:SECRET,nowSeconds:()=>1100});
    await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
    const base="http://127.0.0.1:"+server.address().port;
    const denied=await fetch(base+"/v1/admin/readiness-drift",{headers:{authorization:"Bearer "+signJwtHs256({sub:"u",role:"staging_user",issuer:"hercules-base",audience:"hercules-base-api",ttlSeconds:900,nowSeconds:1000},SECRET)}});
    assert.equal(denied.status,403);
    const allowed=await fetch(base+"/v1/admin/readiness-drift",{headers:{authorization:"Bearer "+owner()}});
    const body=await allowed.json();
    assert.equal(allowed.status,200);
    assert.equal(calls,1);
    assert.equal(body.regressed,true);
    assert.equal(body.activationAllowed,false);
  }finally{
    if(server?.listening)await new Promise((resolve)=>server.close(resolve));
    await rm(root,{recursive:true,force:true});
  }
});
