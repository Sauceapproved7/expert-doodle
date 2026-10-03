import test from "node:test";
import assert from "node:assert/strict";
import {createCanonicalGuardianCatalog} from "../hercules-guardian/canonical-guardian-catalog.mjs";
import {runWatchtowerCycle} from "../hercules-guardian/watchtower-registry.mjs";

const forge={service:{id:"srv-dat58e7lk1mc73eaq310",name:"sauceapproved-forge-control",repo:"https://github.com/Sauceapproved7/expert-doodle",branch:"main",serviceDetails:{runtime:"node",url:"https://sauceapproved-forge-control.onrender.com"}},deployment:{status:"live",commit:{id:"2d8a186b94cc66af7a0e348982d1153f2e8be0bb"}}};
const runtime={service:{id:"srv-daskfp8u01pc73cbvj0g",name:"hercules-browser-standalone",repo:"https://github.com/Sauceapproved7/expert-doodle",branch:"main",serviceDetails:{runtime:"node",url:"https://hercules-browser-standalone.onrender.com"}},deployment:{status:"live",commit:{id:"4aa0a24be36bc734ada1ac34d81782d9ce20f5b1"}}};
const deploy={deploymentId:"deploy-verified-1",request:{artifact:{sha256:"a".repeat(64)},config:{sha256:"b".repeat(64)},target:{identity:"hercules-deploy:production"},policy:{id:"guardian-deploy-v1"}},state:{status:"verified",verificationEvidence:{verified:true}}};
const release={schema:"sauceapproved.hercules.cleaner.package.v1",product:"Hercules Cleaner",version:"1.0.0",sourceCommit:"c".repeat(40),aggregateSha256:"d".repeat(64)};
const installation={sourceCommit:"c".repeat(40),aggregateSha256:"d".repeat(64),recoveryCapsulePreserved:true,rollbackIdentity:"c".repeat(40)};

test("canonical Guardian catalog materializes all five owned evidence domains",async()=>{
 const catalog=await createCanonicalGuardianCatalog({forge,runtime,deploy,cleanerEvidenceReader:async()=>({release,installation})});
 assert.deepEqual(catalog.map(x=>x.id),["studio","forge","deploy","cleaner","runtime"]);
 const cycle=await runWatchtowerCycle(catalog);
 assert.equal(cycle.status,"HEALTHY");
 assert.ok(cycle.results.every(x=>x.status==="HEALTHY"));
 assert.equal(cycle.executionAuthority,false);
});

test("canonical catalog fails closed when Cleaner evidence source disappears",async()=>{
 let available=true;
 const catalog=await createCanonicalGuardianCatalog({forge,runtime,deploy,cleanerEvidenceReader:async()=>{if(!available)throw new Error("device evidence unavailable");return {release,installation}}});
 available=false;
 const cycle=await runWatchtowerCycle(catalog);
 const cleaner=cycle.results.find(x=>x.id==="cleaner");
 assert.equal(cleaner.status,"OBSERVATION_FAILED");
 assert.equal(cycle.status,"DEGRADED");
});

test("canonical catalog refuses missing Cleaner evidence reader",async()=>{
 await assert.rejects(()=>createCanonicalGuardianCatalog({forge,runtime,deploy}),/Cleaner evidence reader is required/);
});
