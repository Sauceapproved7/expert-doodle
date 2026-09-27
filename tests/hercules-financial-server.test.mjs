import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {startHerculesFinancialService} from "../hercules-bank/financial-server.mjs";

const SECRET=Buffer.alloc(48,111).toString("hex");

function authResponse(email){
  return {
    user:{id:"user-alice",email},
    access_token:signJwtHs256({
      sub:"user-alice",
      role:"staging_user",
      issuer:"hercules-base",
      audience:"hercules-base-api",
      ttlSeconds:900,
      nowSeconds:1000,
    },SECRET),
    refresh_token:"r".repeat(48),
  };
}

test("Hercules Financial launcher starts the browser-safe service on loopback", async () => {
  const root=await mkdtemp(join(tmpdir(),"hercules-financial-launch-"));
  try{
    const service=await startHerculesFinancialService({
      statePath:join(root,"bank.json"),
      baseAuthUrl:"https://base.example.test",
      jwtSecret:SECRET,
      port:0,
      nowSeconds:()=>1100,
      randomBytes:(size)=>Buffer.alloc(size,14),
      fetchImpl:async (url,options)=>{
        assert.equal(String(url),"https://base.example.test/v1/auth/signin");
        const body=JSON.parse(options.body);
        return new Response(JSON.stringify(authResponse(body.email)),{status:200});
      },
    });

    assert.match(service.endpoint,/^http:\/\/127\.0\.0\.1:\d+$/);
    const page=await fetch(service.endpoint+"/");
    assert.equal(page.status,200);
    assert.match(await page.text(),/HERCULES FINANCIAL/i);

    const health=await fetch(service.endpoint+"/health");
    const healthBody=await health.json();
    assert.equal(healthBody.browserSessions,true);
    assert.equal(healthBody.externalRails,false);

    await new Promise((resolve)=>service.server.close(resolve));
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test("public Hercules Financial binding requires secure browser cookies", async () => {
  const root=await mkdtemp(join(tmpdir(),"hercules-financial-launch-"));
  try{
    await assert.rejects(
      ()=>startHerculesFinancialService({
        statePath:join(root,"bank.json"),
        baseAuthUrl:"https://base.example.test",
        jwtSecret:SECRET,
        host:"0.0.0.0",
        port:0,
        secureSessionCookies:false,
      }),
      /secure.*cookie|public.*binding/i,
    );
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test("public binding with secure cookies marks the browser session Secure", async () => {
  const root=await mkdtemp(join(tmpdir(),"hercules-financial-launch-"));
  try{
    const service=await startHerculesFinancialService({
      statePath:join(root,"bank.json"),
      baseAuthUrl:"https://base.example.test",
      jwtSecret:SECRET,
      host:"0.0.0.0",
      port:0,
      secureSessionCookies:true,
      nowSeconds:()=>1100,
      randomBytes:(size)=>Buffer.alloc(size,15),
      fetchImpl:async (_url,options)=>{
        const body=JSON.parse(options.body);
        return new Response(JSON.stringify(authResponse(body.email)),{status:200});
      },
    });
    const address=service.server.address();
    const base="http://127.0.0.1:"+address.port;
    const login=await fetch(base+"/v1/session",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        email:"alice@example.test",
        password:"correct horse battery staple",
      }),
    });
    assert.equal(login.status,201);
    assert.match(login.headers.get("set-cookie"),/Secure/);
    await new Promise((resolve)=>service.server.close(resolve));
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});


test("Financial launcher passes qualification evidence status into owner readiness", async () => {
  const root=await mkdtemp(join(tmpdir(),"hercules-financial-qe-"));
  let service=null;
  let calls=0;
  const currentAdapterQualification={qualified:true,activationAllowed:false,externalRailsEnabled:false,checks:{}};
  try{
    service=await startHerculesFinancialService({
      statePath:join(root,"bank.json"),
      baseAuthUrl:"https://base.example.test",
      jwtSecret:SECRET,
      port:0,
      nowSeconds:()=>1100,
      qualificationEvidenceStore:{
        status:async({currentQualification})=>{
          calls+=1;
          assert.equal(currentQualification,currentAdapterQualification);
          return {
            ready:false,
            stale:true,
            identityChanged:false,
            blockers:["qualification evidence is stale or expired"],
            activationAllowed:false,
            externalRailsEnabled:false,
          };
        },
      },
      currentAdapterQualification,
    });
    const ownerToken=signJwtHs256({
      sub:"owner-1",
      role:"owner",
      issuer:"hercules-base",
      audience:"hercules-base-api",
      ttlSeconds:900,
      nowSeconds:1000,
    },SECRET);
    const response=await fetch(service.endpoint+"/v1/admin/production-readiness",{
      headers:{authorization:"Bearer "+ownerToken},
    });
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(calls,1);
    assert.equal(body.controls.adapterQualification.stale,true);
    assert.equal(body.activationAllowed,false);
  }finally{
    if(service?.server?.listening)await new Promise((resolve)=>service.server.close(resolve));
    await rm(root,{recursive:true,force:true});
  }
});


test("Financial launcher opens a durable readiness drift sentinel", async () => {
  const root=await mkdtemp(join(tmpdir(),"hercules-financial-drift-"));
  let service=null;
  try{
    service=await startHerculesFinancialService({
      statePath:join(root,"bank.json"),
      baseAuthUrl:"https://base.example.test",
      jwtSecret:SECRET,
      port:0,
      nowSeconds:()=>1100,
    });
    assert.ok(service.readinessDriftSentinel);
    assert.equal(typeof service.readinessDriftSentinel.check,"function");

    const ownerToken=signJwtHs256({
      sub:"owner-1",
      role:"owner",
      issuer:"hercules-base",
      audience:"hercules-base-api",
      ttlSeconds:900,
      nowSeconds:1000,
    },SECRET);
    const response=await fetch(service.endpoint+"/v1/admin/readiness-drift",{
      headers:{authorization:"Bearer "+ownerToken},
    });
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.activationAllowed,false);
    assert.equal(body.externalRailsEnabled,false);
  }finally{
    if(service?.server?.listening)await new Promise((resolve)=>service.server.close(resolve));
    await rm(root,{recursive:true,force:true});
  }
});
