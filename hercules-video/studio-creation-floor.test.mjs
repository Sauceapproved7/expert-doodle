import test from "node:test";
import assert from "node:assert/strict";
import {createStudioManifest} from "./studio-contract.mjs";
test("Studio manifest exposes Hercules Creation Floor as a first-class owned surface",()=>{
 const m=createStudioManifest();
 const floor=m.surfaces.find(x=>x.id==="creation-floor");
 assert.deepEqual(floor,{
  id:"creation-floor",
  label:"Creation Floor",
  implementationOwner:"SauceApproved enterprise LLC",
  herculesOwned:true,
  outsidePlatformAllowed:false
 });
});
