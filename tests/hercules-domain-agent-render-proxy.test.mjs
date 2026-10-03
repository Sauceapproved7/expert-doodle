import test from "node:test";
import assert from "node:assert/strict";

const mod=await import("../render/domain-agent-proxy/proxy.mjs");

test("Render front door routes only the intended Domain Agent surfaces",()=>{
  assert.equal(mod.upstreamFor(new URL("https://proxy.test/.well-known/hercules-agent.json")),"https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge?domain_agent=discovery");
  assert.equal(mod.upstreamFor(new URL("https://proxy.test/health")),"https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge?domain_agent=health");
  assert.equal(mod.upstreamFor(new URL("https://proxy.test/v1/execute")),"https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge");
  assert.equal(mod.upstreamFor(new URL("https://proxy.test/admin")),null);
});

test("Render front door preserves caller authorization and strips internal credentials",async()=>{
  let captured;
  const fetchImpl=async(url,init)=>{
    captured={url,init};
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{"set-cookie":"secret=1","content-type":"application/json"}});
  };
  const req=new Request("https://proxy.test/v1/execute",{
    method:"POST",
    headers:{
      authorization:"Bearer tenant-token",
      "x-hercules-internal-key":"must-not-forward",
      "content-type":"application/json"
    },
    body:JSON.stringify({action:"status"})
  });
  const res=await mod.proxyRequest(req,fetchImpl);
  assert.equal(captured.url,"https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge");
  assert.equal(captured.init.headers.get("authorization"),"Bearer tenant-token");
  assert.equal(captured.init.headers.get("x-hercules-internal-key"),null);
  assert.equal(captured.init.headers.get("x-hercules-front-door"),"agent.sauceapproved.com");
  assert.equal(res.headers.get("set-cookie"),null);
  assert.equal(res.headers.get("cache-control"),"no-store");
});

test("Render front door fails closed for unknown paths",async()=>{
  let called=false;
  const res=await mod.proxyRequest(new Request("https://proxy.test/not-allowed"),async()=>{called=true;return new Response("bad")});
  assert.equal(res.status,404);
  assert.equal(called,false);
});
