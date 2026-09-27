import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {createHerculesBankApi} from "../hercules-bank/api.mjs";
import {HerculesBankRuntime} from "../hercules-bank/runtime.mjs";

const SECRET=Buffer.alloc(48,88).toString("hex");
function bearer(sub,role="staging_user"){
  return signJwtHs256({sub,role,issuer:"hercules-base",audience:"hercules-base-api",ttlSeconds:900,nowSeconds:1000},SECRET);
}
async function get(base,path,token){
  const response=await fetch(base+path,{headers:{authorization:"Bearer "+token}});
  return {response,body:await response.json()};
}

test("owner overview is admin-only and summarizes sandbox liabilities",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-bank-owner-"));
  try{
    const runtime=await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const alice=await runtime.openCustomerAccount({customerId:"alice"});
    const bob=await runtime.openCustomerAccount({customerId:"bob"});
    await runtime.fundSandboxAccount({accountId:alice.id,amountMinor:8000,idempotencyKey:"fund"});
    await runtime.transfer({fromAccountId:alice.id,toAccountId:bob.id,amountMinor:2500,idempotencyKey:"send"});

    const server=createHerculesBankApi({runtime,jwtSecret:SECRET,nowSeconds:()=>1100});
    await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
    const base="http://127.0.0.1:"+server.address().port;

    const denied=await get(base,"/v1/admin/overview",bearer("alice"));
    assert.equal(denied.response.status,403);

    const allowed=await get(base,"/v1/admin/overview",bearer("operator","owner"));
    assert.equal(allowed.response.status,200);
    assert.equal(allowed.body.mode,"SANDBOX");
    assert.equal(allowed.body.currency,"USD");
    assert.equal(allowed.body.externalRails,false);
    assert.equal(allowed.body.accountCount,2);
    assert.equal(allowed.body.customerCount,2);
    assert.equal(allowed.body.totalCustomerBalanceMinor,8000);
    assert.equal(allowed.body.accounts.length,2);
    assert.equal("journal" in allowed.body,false);

    await new Promise((resolve)=>server.close(resolve));
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});
