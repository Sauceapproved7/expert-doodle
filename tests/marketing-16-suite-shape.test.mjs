import test from "node:test";
import assert from "node:assert/strict";
import {createMarketing16Manifest} from "../sauceapproved-studio/marketing-16/core.mjs";

test("Marketing 16 contains sixteen growth modules plus an external Kill Switch safety controller", () => {
  const manifest=createMarketing16Manifest();
  assert.equal(manifest.modules.length,16);
  assert.equal(manifest.modules.some(module=>module.name==="Kill Switch"),false);
  assert.equal(manifest.safetyController.name,"Kill Switch");
  assert.equal(manifest.safetyController.kind,"safety");
  assert.equal(manifest.safetyController.failClosed,true);
});

test("Growth Signal Router is the sixteenth marketing module", () => {
  const manifest=createMarketing16Manifest();
  const module=manifest.modules.find(item=>item.name==="Growth Signal Router");
  assert.ok(module);
  assert.equal(module.kind,"routing");
  assert.equal(module.evidenceRequired,true);
});
