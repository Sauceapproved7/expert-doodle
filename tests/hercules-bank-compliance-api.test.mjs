import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {createHerculesBankApi} from "../hercules-bank/api.mjs";
import {HerculesBankRuntime} from "../hercules-bank/runtime.mjs";
import {HerculesComplianceOperations} from "../hercules-bank/compliance-operations.mjs";

const SECRET=Buffer.alloc(48,91).toString("hex");
function token(sub,role="staging_user"){
  return signJwtHs256({sub,role,issuer:"hercules-base",audience:"hercules-base-api",ttlSeconds:900,nowSeconds:1000},SECRET);
}
async function call(base,path,{method="GET",bearer,body}={}){
  const headers={};
  if(bearer)headers.authorization="Bearer "+bearer;
  if(body!==undefined)headers["content-type"]="application/json";
  const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  return {response,body:await response.json()};
}

test("compliance dashboard and evidence writes are owner-only",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-compliance-api-"));
  let server=null;
  try{
    const runtime=await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const compliance=await HerculesComplianceOperations.open({statePath:join(root,"compliance.json")});
    server=createHerculesBankApi({
      runtime,
      complianceOperations:compliance,
      jwtSecret:SECRET,
      nowSeconds:()=>1100,
    });
    await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
    const base="http://127.0.0.1:"+server.address().port;

    const denied=await call(base,"/v1/admin/compliance",{bearer:token("alice")});
    assert.equal(denied.response.status,403);

    const initial=await call(base,"/v1/admin/compliance",{bearer:token("owner","owner")});
    assert.equal(initial.response.status,200);
    assert.equal(initial.body.executionEnabled,false);
    assert.equal(initial.body.readiness.ready,false);

    const written=await call(base,"/v1/admin/compliance/evidence",{
      method:"POST",
      bearer:token("owner","owner"),
      body:{
        control:"legalReview",
        status:"approved",
        reference:"legal:launch-review",
        reviewedAt:"2026-09-27T06:00:00Z",
      },
    });
    assert.equal(written.response.status,200);
    assert.equal(written.body.evidence.legalReview.reference,"legal:launch-review");
    assert.equal(written.body.executionEnabled,false);
  }finally{
    if(server?.listening)await new Promise((resolve)=>server.close(resolve));
    await rm(root,{recursive:true,force:true});
  }
});
