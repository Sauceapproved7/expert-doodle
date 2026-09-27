import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {HerculesBankRuntime} from "../hercules-bank/runtime.mjs";
import {createHerculesBankBrowserService} from "../hercules-bank/browser-service.mjs";

const SECRET=Buffer.alloc(48,101).toString("hex");

test("browser service composes Base Auth, secure sessions, console, and bank API", async () => {
  const root=await mkdtemp(join(tmpdir(),"hercules-bank-browser-service-"));
  try{
    const runtime=await HerculesBankRuntime.open({statePath:join(root,"bank.json")});
    const fetchImpl=async (url,options)=>{
      assert.equal(String(url),"http://base.internal:8787/v1/auth/signin");
      const body=JSON.parse(options.body);
      assert.equal(body.email,"alice@example.test");
      return new Response(JSON.stringify({
        user:{id:"user-alice",email:body.email},
        access_token:signJwtHs256({
          sub:"user-alice",
          role:"staging_user",
          issuer:"hercules-base",
          audience:"hercules-base-api",
          ttlSeconds:900,
          nowSeconds:1000,
        },SECRET),
        refresh_token:"r".repeat(48),
      }),{status:200});
    };

    const service=createHerculesBankBrowserService({
      runtime,
      baseAuthUrl:"http://base.internal:8787",
      jwtSecret:SECRET,
      fetchImpl,
      nowSeconds:()=>1100,
      randomBytes:(size)=>Buffer.alloc(size,13),
    });
    await new Promise((resolve)=>service.server.listen(0,"127.0.0.1",resolve));
    const base="http://127.0.0.1:"+service.server.address().port;

    const health=await fetch(base+"/health");
    const healthBody=await health.json();
    assert.equal(healthBody.browserSessions,true);

    const page=await fetch(base+"/");
    assert.equal(page.status,200);
    assert.match(await page.text(),/HERCULES FINANCIAL/i);

    const login=await fetch(base+"/v1/session",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        email:"alice@example.test",
        password:"correct horse battery staple",
      }),
    });
    assert.equal(login.status,201);
    assert.match(login.headers.get("set-cookie"),/HttpOnly/);

    await new Promise((resolve)=>service.server.close(resolve));
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});
