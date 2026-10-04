import test from "node:test";
import assert from "node:assert/strict";
import {createCommandCenterModel} from "../hercules-command-center/model.mjs";

test("command center stays provider-neutral and fail-closed", () => {
  const model = createCommandCenterModel({
    core:{state:"ready"},
    stages:["idea","build","test","secure","deploy"],
    owner:{verified:false},
    evidence:[]
  });
  assert.equal(model.executionAuthority,false);
  assert.equal(model.owner.actionsEnabled,false);
  assert.deepEqual(model.pipeline.map((stage)=>stage.id),["idea","build","test","secure","deploy"]);
  assert.equal(JSON.stringify(model).toLowerCase().includes("github"),false);
});

test("owner controls require explicit verified owner state", () => {
  const model=createCommandCenterModel({owner:{verified:true}});
  assert.equal(model.owner.actionsEnabled,true);
});
