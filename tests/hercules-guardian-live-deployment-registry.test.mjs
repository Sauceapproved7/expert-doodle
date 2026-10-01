import test from "node:test";
import assert from "node:assert/strict";
import {createLiveDeploymentRegistry} from "../hercules-guardian/live-deployment-registry.mjs";

const forge={service:{id:"srv-dat58e7lk1mc73eaq310",name:"sauceapproved-forge-control",repo:"https://github.com/Sauceapproved7/expert-doodle",branch:"main",serviceDetails:{runtime:"node",url:"https://sauceapproved-forge-control.onrender.com"}},deployment:{status:"live",commit:{id:"2d8a186b94cc66af7a0e348982d1153f2e8be0bb"}}};
const runtime={service:{id:"srv-daskfp8u01pc73cbvj0g",name:"hercules-browser-standalone",repo:"https://github.com/Sauceapproved7/expert-doodle",branch:"main",serviceDetails:{runtime:"node",url:"https://hercules-browser-standalone.onrender.com"}},deployment:{status:"live",commit:{id:"4aa0a24be36bc734ada1ac34d81782d9ce20f5b1"}}};

test("live registry pins Forge and canonical Browser runtime baselines",async()=>{
 const registry=createLiveDeploymentRegistry({forge,runtime});
 assert.deepEqual(registry.map(x=>x.id),["forge","runtime"]);
 for(const item of registry){const observed=await item.observe();assert.deepEqual(observed,item.baseline);assert.equal(item.executionAuthority,false)}
});
test("live registry rejects unverified deployment identities",()=>assert.throws(()=>createLiveDeploymentRegistry({forge:{...forge,deployment:{status:"build_failed",commit:{id:"x"}}},runtime}),/live deployment evidence is required/));
