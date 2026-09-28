import test from "node:test";
import assert from "node:assert/strict";
import {createCommandRequest,listCommandCapabilities,routeCommand} from "../hercules-runtime/command-surface.mjs";

test("unified command surface routes cleaner intents without granting execution authority",()=>{
  for(const capability of ["cleaner.scan","cleaner.clean","cleaner.session"]) {
    assert.ok(listCommandCapabilities().includes(capability));
  }
  const command=createCommandRequest({
    intentId:"cleaner-intent-1",
    capability:"cleaner.clean",
    payload:{profileId:"quick-safe"},
  });
  const route=routeCommand(command);
  assert.equal(route.route,"hercules-cleaner");
  assert.equal(route.executionAuthority,false);
});
