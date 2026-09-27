import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {createHerculesBankApi} from "../hercules-bank/api.mjs";
import {HerculesBankRuntime} from "../hercules-bank/runtime.mjs";
import {HerculesComplianceOperations} from "../hercules-bank/compliance-operations.mjs";

const SECRET=Buffer.alloc(48,93).toString("hex");
function token(sub,role="staging_user"){
  return signJwtHs256({sub,role,issuer:"hercules-base",audience:"hercules-base-api",ttlSeconds:900,nowSeconds:1000},SECRET);
}

test("production-readiness dossier is owner-only and remains locked by default",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-readiness-api-"));
  let server=null;
  try{
    const runtime=await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const complianceOperations=await HerculesComplianceOperations.open({statePath:join(root,"compliance.json")});
    server=createHerculesBankApi({
      runtime,
      complianceOperations,
      jwtSecret:SECRET,
      nowSeconds:()=>1100,
    });
    await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
    const base="http://127.0.0.1:"+server.address().port;

    const denied=await fetch(base+"/v1/admin/production-readiness",{headers:{authorization:"Bearer "+token("alice")}});
    assert.equal(denied.status,403);

    const allowed=await fetch(base+"/v1/admin/production-readiness",{headers:{authorization:"Bearer "+token("operator","owner")}});
    const body=await allowed.json();
    assert.equal(allowed.status,200);
    assert.equal(body.ready,false);
    assert.equal(body.activationAllowed,false);
    assert.equal(body.externalRailsEnabled,false);
    assert.ok(body.blockers.length>0);
    assert.equal(JSON.stringify(body).includes("withTransaction"),false);
  }finally{
    if(server?.listening)await new Promise((resolve)=>server.close(resolve));
    await rm(root,{recursive:true,force:true});
  }
});
