import test from "node:test";
import assert from "node:assert/strict";
import {createCanonicalBrowserRuntimeObserver} from "../hercules-guardian/canonical-browser-runtime.mjs";

test("Guardian runtime trusts only the owned canonical Hercules Browser standalone service",async()=>{
 const observer=createCanonicalBrowserRuntimeObserver({
  service:{id:"srv-daskfp8u01pc73cbvj0g",name:"hercules-browser-standalone",repo:"https://github.com/Sauceapproved7/expert-doodle",branch:"main",serviceDetails:{runtime:"node",url:"https://hercules-browser-standalone.onrender.com"}},
  deployment:{status:"live",commit:{id:"4aa0a24be36bc734ada1ac34d81782d9ce20f5b1"}}
 });
 const evidence=await observer();
 assert.equal(evidence.identity,"render:srv-daskfp8u01pc73cbvj0g:hercules-browser-standalone");
 assert.equal(evidence.policy,"guardian-browser-runtime-v1");
});
test("Guardian runtime rejects legacy Browserless service",()=>{
 assert.throws(()=>createCanonicalBrowserRuntimeObserver({
  service:{id:"srv-dams01rm8hqs73f4dn2g",name:"hercules-browser-runtime",repo:"https://github.com/browserless/browserless",branch:"main",serviceDetails:{runtime:"node",url:"https://hercules-browser-runtime.onrender.com"}},
  deployment:{status:"live",commit:{id:"6b5171ca6e5bd1099689dab5c7e4828f5236c54a"}}
 }),/canonical owned browser runtime required/);
});
