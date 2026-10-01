import test from "node:test";
import assert from "node:assert/strict";
import {createProductionGuardianRuntime} from "../hercules-guardian/production-watchtower-runtime.mjs";

function fakeFetch(url){
 const u=String(url);
 const body=u.includes("sauceapproved-forge-control")
  ? {ok:true,service:"hercules-forge-control-api",version:"1.6",mode:"production",publicOrigin:"https://sauceapproved-forge-control.onrender.com"}
  : u.includes("hercules-browser-standalone")
    ? {ok:true,service:"hercules-browser-standalone",version:"1.0.0",engine:"playwright-local-chromium",rawCodeExecution:false,antiBotBypass:false}
    : {ok:true,service:"hercules-deploy-controller",version:"1.9.0",policy:"deployment-required",operatorInteraction:"conversation_only",manualOperatorStepsAllowed:false};
 return Promise.resolve({ok:true,status:200,json:async()=>body});
}

test("production Guardian runtime reports the three remote control feeds plus Studio while Cleaner fails closed",async()=>{
 const runtime=await createProductionGuardianRuntime({fetchImpl:fakeFetch,intervalMs:1000});
 const cycle=await runtime.tick();
 assert.deepEqual(cycle.results.map(x=>x.id),["studio","forge","deploy","cleaner","runtime"]);
 assert.equal(cycle.status,"DEGRADED");
 assert.equal(cycle.results.find(x=>x.id==="studio").status,"HEALTHY");
 assert.equal(cycle.results.find(x=>x.id==="forge").status,"HEALTHY");
 assert.equal(cycle.results.find(x=>x.id==="deploy").status,"HEALTHY");
 assert.equal(cycle.results.find(x=>x.id==="runtime").status,"HEALTHY");
 assert.equal(cycle.results.find(x=>x.id==="cleaner").status,"OBSERVATION_FAILED");
 assert.match(cycle.results.find(x=>x.id==="cleaner").reason,/device evidence unavailable/);
 assert.equal(cycle.executionAuthority,false);
 runtime.stop();
});

test("production Guardian runtime rejects browser health that weakens safety invariants",async()=>{
 const fetchImpl=async(url)=>{
  const r=await fakeFetch(url);
  const body=await r.json();
  if(String(url).includes("hercules-browser-standalone"))body.rawCodeExecution=true;
  return {ok:true,status:200,json:async()=>body};
 };
 const runtime=await createProductionGuardianRuntime({fetchImpl,intervalMs:1000});
 const cycle=await runtime.tick();
 const browser=cycle.results.find(x=>x.id==="runtime");
 assert.equal(browser.status,"OBSERVATION_FAILED");
 assert.match(browser.reason,/browser health invariant failed/);
 runtime.stop();
});

test("production Guardian runtime accepts an explicit Cleaner normalized evidence reader without adding execution authority",async()=>{
 const cleaner={
  artifact:"sha256:"+"1".repeat(64),
  config:"sha256:"+"2".repeat(64),
  identity:"cleaner:1.0.0:77093aceae5d5df5a3ae4d3947b607473ff15db9",
  policy:"guardian-cleaner-release-v1"
 };
 const runtime=await createProductionGuardianRuntime({fetchImpl:fakeFetch,cleanerEvidenceReader:async()=>cleaner,cleanerBaseline:cleaner,intervalMs:1000});
 const cycle=await runtime.tick();
 assert.equal(cycle.status,"HEALTHY");
 assert.equal(cycle.results.find(x=>x.id==="cleaner").status,"HEALTHY");
 assert.equal(runtime.executionAuthority,false);
 assert.equal("executeContainment" in runtime,false);
 runtime.stop();
});
