import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createSmokeScreenAgent} from "../hercules-runtime/smokescreen-agent.mjs";
import {createForgeSmokeScreenObserver} from "../hercules-runtime/smokescreen-forge-ingress.mjs";
import {createForgeControlService} from "../hercules-forge/control-api.mjs";

const key="0123456789abcdef0123456789abcdef";
const token=["forge","control","smokescreen","observe","fixture"].join("-");

test("observe-only ingress can identify hostile patterns without applying enforcement", async()=>{
  const decisions=[];
  const agent=createSmokeScreenAgent({hmacKey:key,now:()=>1_790_000_000_000});
  const observer=createForgeSmokeScreenObserver({
    agent,
    mode:"OBSERVE_ONLY",
    now:()=>1_790_000_000_000,
    onDecision:async(result)=>decisions.push(result),
  });

  let latest;
  for(let index=0;index<10;index+=1){
    latest=await observer.observe({
      method:"POST",
      pathname:"/v1/admin/export",
      statusCode:401,
      remoteAddress:"203.0.113.20",
      userAgent:"synthetic-security-test",
      hasAuthorizationHeader:true,
    });
  }

  assert.ok(["QUARANTINE","CONTAIN"].includes(latest.decision.disposition));
  assert.equal(latest.mode,"OBSERVE_ONLY");
  assert.equal(latest.enforcementApplied,false);
  assert.equal(latest.wouldRouteMode,"DECOY");
  assert.equal(latest.outboundCounterattack,false);
  assert.equal(decisions.length,10);
});

test("observe-only ingress hashes client identity and never returns raw network identifiers", async()=>{
  const agent=createSmokeScreenAgent({hmacKey:key,now:()=>1_790_000_000_000});
  const observer=createForgeSmokeScreenObserver({
    agent,
    mode:"OBSERVE_ONLY",
    now:()=>1_790_000_000_000,
  });

  const remoteAddress="198.51.100.99";
  const userAgent="private-test-agent";
  const result=await observer.observe({
    method:"GET",
    pathname:"/health",
    statusCode:200,
    remoteAddress,
    userAgent,
  });

  const serialized=JSON.stringify(result);
  assert.equal(result.decision.disposition,"OBSERVE");
  assert.equal(serialized.includes(remoteAddress),false);
  assert.equal(serialized.includes(userAgent),false);
  assert.match(result.clientFingerprint,/^[a-f0-9]{32}$/);
});

test("Forge Control API attaches SmokeScreen observation without changing customer responses", async()=>{
  const root=await mkdtemp(join(tmpdir(),"forge-smokescreen-observe-"));
  const observations=[];
  const agent=createSmokeScreenAgent({hmacKey:key,now:()=>1_790_000_000_000});
  const smokeScreenObserver=createForgeSmokeScreenObserver({
    agent,
    mode:"OBSERVE_ONLY",
    now:()=>1_790_000_000_000,
    onDecision:async(result)=>observations.push(result),
  });
  const server=createForgeControlService({root,token,smokeScreenObserver});
  await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();
  const base="http://127.0.0.1:"+address.port;

  try{
    const health=await fetch(base+"/health");
    assert.equal(health.status,200);
    const healthBody=await health.json();
    assert.equal(healthBody.ok,true);
    assert.deepEqual(healthBody.smokeScreen,{
      enabled:true,
      mode:"OBSERVE_ONLY",
      enforcement:false,
    });

    const denied=await fetch(base+"/v1/projects",{
      headers:{authorization:"Bearer wrong-token"},
    });
    assert.equal(denied.status,401);

    await new Promise((resolve)=>setImmediate(resolve));
    assert.ok(observations.length>=2);
    assert.equal(observations.every((item)=>item.enforcementApplied===false),true);
    assert.equal(observations.every((item)=>item.outboundCounterattack===false),true);
  }finally{
    await new Promise((resolve)=>server.close(resolve));
    await rm(root,{recursive:true,force:true});
  }
});
