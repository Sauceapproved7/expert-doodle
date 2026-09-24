import test from "node:test";
import assert from "node:assert/strict";
import {validateHurcDeploymentIntent} from "../hercules-hurc/validate-deployment-intent.mjs";

const valid = {
  schema: "sauceapproved.hercules.hurc.deployment-intent",
  version: 1,
  network: "base-sepolia",
  chainId: 84532,
  treasuryAddress: "0x1111111111111111111111111111111111111111",
  initialSupplyWholeTokens: "100000000",
  broadcast: false,
};

test("accepts a complete Base Sepolia HURC testnet intent", () => {
  assert.deepEqual(validateHurcDeploymentIntent(valid), {ok:true, errors:[]});
});

test("rejects mainnet and any non-Base-Sepolia chain", () => {
  for (const patch of [
    {network:"base"},
    {chainId:8453},
    {network:"ethereum-mainnet", chainId:1},
  ]) {
    assert.equal(validateHurcDeploymentIntent({...valid, ...patch}).ok, false);
  }
});

test("rejects zero/invalid treasury addresses and invalid supplies", () => {
  for (const patch of [
    {treasuryAddress:"0x0000000000000000000000000000000000000000"},
    {treasuryAddress:"not-an-address"},
    {initialSupplyWholeTokens:"0"},
    {initialSupplyWholeTokens:"-1"},
    {initialSupplyWholeTokens:"1.5"},
  ]) {
    assert.equal(validateHurcDeploymentIntent({...valid, ...patch}).ok, false);
  }
});

test("repository deployment intents cannot enable broadcasting", () => {
  const result = validateHurcDeploymentIntent({...valid, broadcast:true});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes("broadcast=false")));
});
