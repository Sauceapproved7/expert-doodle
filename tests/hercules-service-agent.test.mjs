import test from "node:test";
import assert from "node:assert/strict";
import {createServiceSession, authorizeServiceSession, planRepair} from "../hercules-service-agent/core.mjs";

test("service session starts read-only and excludes private-content collection",()=>{
  const s=createServiceSession({customerConsent:true,deviceId:"device-1"});
  assert.equal(s.mode,"diagnostic");
  assert.equal(s.permissions.mutate,false);
  assert.equal(s.permissions.privateContent,false);
});

test("mutation requires explicit repair authorization and recovery capsule",()=>{
  const s=authorizeServiceSession(createServiceSession({customerConsent:true,deviceId:"device-1"}),{repairApproval:true});
  assert.throws(()=>planRepair({session:s,diagnosis:{code:"startup-load",severity:"medium"},capsule:null}),/recovery capsule/i);
  const p=planRepair({session:s,diagnosis:{code:"startup-load",severity:"medium"},capsule:{id:"cap-1",verified:true}});
  assert.equal(p.failClosed,true);
  assert.equal(p.requiresVerification,true);
});
