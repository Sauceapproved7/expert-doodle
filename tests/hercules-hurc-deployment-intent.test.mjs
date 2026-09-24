import test from "node:test";
import assert from "node:assert/strict";
import {validateDeploymentIntent} from "../hercules-hurc/validate-deployment-intent.mjs";

const base = {
  schema: "sauceapproved.hercules.hurc-deployment-intent",
  version: 1,
  token: {name:"Hercules Coin", symbol:"HURC"},
  source: "hercules-hurc/HURC.sol",
  network: {environment:"testnet", chainId:84532, name:"testnet"},
  treasuryAddress: "0x1111111111111111111111111111111111111111",
  initialSupplyWholeTokens: 100000000,
  authorization: {mainnetApproved:false}
};

test("accepts a complete testnet intent", () => {
  assert.deepEqual(validateDeploymentIntent(base), {ok:true, errors:[]});
});

test("rejects mainnet and secret material", () => {
  const result = validateDeploymentIntent({...base, network:{...base.network, environment:"mainnet"}, privateKey:"do-not-store"});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(x => x.includes("testnet")));
  assert.ok(result.errors.some(x => x.includes("secrets")));
});

test("rejects zero treasury and invalid supply", () => {
  const result = validateDeploymentIntent({...base, treasuryAddress:"0x0000000000000000000000000000000000000000", initialSupplyWholeTokens:0});
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 2);
});
