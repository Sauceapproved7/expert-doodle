import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");
const handler=await readFile(new URL("../supabase/functions/hercules-private-bridge/cleaner-device.ts",import.meta.url),"utf8");
const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");

test("owner bridge can list only Cleaner access requests eligible for activation review",()=>{
  assert.match(bridge,/cleaner_activation_requests/);
  assert.match(bridge,/hercules_software_access_requests/);
  assert.match(bridge,/product_code.*hercules-cleaner/s);
  assert.match(bridge,/new.*reviewing.*qualified.*invited/s);
  assert.doesNotMatch(bridge,/select\([^)]*message[^)]*\).*cleaner_activation_requests/s);
});

test("activation-code issuance remains owner authenticated and can bind to an approved Cleaner request",()=>{
  assert.match(handler,/issue_activation_code/);
  assert.match(handler,/ownerAuth/);
  assert.match(handler,/accessRequestId/);
  assert.match(handler,/hercules_software_access_requests/);
  assert.match(handler,/product_code.*PRODUCT/s);
  assert.match(handler,/activationCode/);
  assert.match(handler,/expiresAt/);
});

test("owner integrations UI has Cleaner activation controls without exposing local device data",()=>{
  assert.match(ui,/Cleaner Device Activation/);
  assert.match(ui,/cleaneractivationrefresh/);
  assert.match(ui,/cleaneractivationrows/);
  assert.match(ui,/Issue one-time code/);
  assert.match(ui,/cleaner_activation_requests/);
  assert.match(ui,/issue_activation_code/);
  assert.match(ui,/expires/i);
  assert.doesNotMatch(ui,/hardware serial|MAC address|local filenames|Recovery Capsule contents/i);
});

test("onboarding UI does not auto-approve access or commercial gates",()=>{
  assert.doesNotMatch(ui,/status:\s*['"]qualified['"].*cleaner_activation/i);
  assert.doesNotMatch(ui,/checkout_enabled\s*[:=]\s*true/i);
  assert.doesNotMatch(handler,/checkout_enabled\s*[:=]\s*true/i);
});
