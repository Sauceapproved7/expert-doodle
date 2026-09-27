import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {createHerculesBankApi} from "../hercules-bank/api.mjs";
import {HerculesBankRuntime} from "../hercules-bank/runtime.mjs";
import {HerculesComplianceOperations} from "../hercules-bank/compliance-operations.mjs";

const SECRET=Buffer.alloc(48,94).toString("hex");
function token(){
  return signJwtHs256({sub:"operator",role:"owner",issuer:"hercules-base",audience:"hercules-base-api",ttlSeconds:900,nowSeconds:1000},SECRET);
}

test("owner readiness API consumes current qualification evidence status and downgrades stale evidence",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-qe-api-"));
  let server=null;
  let statusCalls=0;
  const currentAdapterQualification={qualified:true,activationAllowed:false,externalRailsEnabled:false,checks:{}};
  const qualificationEvidenceStore={
    status:async({currentQualification,now})=>{
      statusCalls+=1;
      assert.equal(currentQualification,currentAdapterQualification);
      assert.equal(now,"1970-01-01T00:18:20.000Z");
      return {
        ready:false,
        stale:true,
        identityChanged:false,
        qualifiedAt:"2026-09-20T00:00:00Z",
        expiresAt:"2026-09-21T00:00:00Z",
        blockers:["qualification evidence is stale or expired"],
        activationAllowed:false,
        externalRailsEnabled:false,
      };
    },
  };

  try{
    const runtime=await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const complianceOperations=await HerculesComplianceOperations.open({statePath:join(root,"compliance.json")});
    server=createHerculesBankApi({
      runtime,
      complianceOperations,
      qualificationEvidenceStore,
      currentAdapterQualification,
      jwtSecret:SECRET,
      nowSeconds:()=>1100,
    });
    await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
    const response=await fetch("http://127.0.0.1:"+server.address().port+"/v1/admin/production-readiness",{
      headers:{authorization:"Bearer "+token()},
    });
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(statusCalls,1);
    assert.equal(body.controls.adapterQualification.ready,false);
    assert.equal(body.controls.adapterQualification.stale,true);
    assert.match(body.blockers.join("\n"),/stale or expired/i);
    assert.equal(body.activationAllowed,false);
    assert.equal(body.externalRailsEnabled,false);
  }finally{
    if(server?.listening)await new Promise((resolve)=>server.close(resolve));
    await rm(root,{recursive:true,force:true});
  }
});
