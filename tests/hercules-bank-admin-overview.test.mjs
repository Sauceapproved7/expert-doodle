import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {createHerculesBankApi} from "../hercules-bank/api.mjs";
import {HerculesBankRuntime} from "../hercules-bank/runtime.mjs";

const SECRET=Buffer.alloc(48,88).toString("hex");
function token(sub,role="staging_user"){
  return signJwtHs256({sub,role,issuer:"hercules-base",audience:"hercules-base-api",ttlSeconds:900,nowSeconds:1000},SECRET);
}
async function call(base,path,{bearer}={}){
  const response=await fetch(base+path,{headers:bearer?{authorization:"Bearer "+bearer}:{}});
  return {response,body:await response.json()};
}

test("owner overview summarizes sandbox accounts without exposing journal internals", async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-bank-admin-"));
  try{
    const runtime=await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const a=await runtime.openCustomerAccount({customerId:"alice"});
    const b=await runtime.openCustomerAccount({customerId:"bob"});
    await runtime.fundSandboxAccount({accountId:a.id,amountMinor:5000,idempotencyKey:"fund-a"});
    await runtime.transfer({fromAccountId:a.id,toAccountId:b.id,amountMinor:1200,idempotencyKey:"a-b"});

    const server=createHerculesBankApi({runtime,jwtSecret:SECRET,nowSeconds:()=>1100});
    await new Promise(r=>server.listen(0,"127.0.0.1",r));
    const base="http://127.0.0.1:"+server.address().port;

    const denied=await call(base,"/v1/admin/overview",{bearer:token("alice")});
    assert.equal(denied.response.status,403);

    const owner=await call(base,"/v1/admin/overview",{bearer:token("operator","owner")});
    assert.equal(owner.response.status,200);
    assert.equal(owner.body.mode,"SANDBOX");
    assert.equal(owner.body.accountCount,2);
    assert.equal(owner.body.customerCount,2);
    assert.equal(owner.body.totalCustomerBalanceMinor,5000);
    assert.equal(owner.body.externalRails,false);
    assert.equal(owner.body.accounts.length,2);
    assert.equal("journal" in owner.body,false);

    await new Promise(r=>server.close(r));
  }finally{await rm(root,{recursive:true,force:true})}
});
