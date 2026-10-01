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


test("Windows diagnostics normalize only technical-health signals",async()=>{
  const {normalizeWindowsDiagnostics}=await import("../hercules-service-agent/windows-diagnostics.mjs");
  const report=normalizeWindowsDiagnostics({
    platform:"win32",freeDiskPercent:7,memoryPressurePercent:91,
    pendingReboot:true,failedUpdates:2,startupImpact:"high",
    privateFiles:["secret.docx"],browserHistory:["example.com"]
  });
  assert.equal(report.schema,"sauceapproved.hercules-service-agent.diagnostic-report");
  assert.equal(report.signals.disk.status,"critical");
  assert.equal(report.signals.memory.status,"warning");
  assert.equal(report.signals.updates.status,"warning");
  assert.equal("privateFiles" in report,false);
  assert.equal("browserHistory" in report,false);
});

test("repair catalog is allow-listed and rejects unknown repair codes",async()=>{
  const {getRepairModule}=await import("../hercules-service-agent/repair-catalog.mjs");
  assert.equal(getRepairModule("clear-user-temp").risk,"low");
  assert.equal(getRepairModule("repair-windows-image").requiresElevation,true);
  assert.throws(()=>getRepairModule("run-arbitrary-command"),/not allow-listed/i);
});
