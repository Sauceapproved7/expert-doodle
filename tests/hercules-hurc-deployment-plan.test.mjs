import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHurcDeploymentPlan,
} from "../hercules-hurc/deployment-plan.mjs";

const TREASURY = "0x1111111111111111111111111111111111111111";

test("builds a Base Sepolia HURC deployment plan without signing or broadcasting", () => {
  const plan = buildHurcDeploymentPlan({
    network: "base-sepolia",
    treasuryAddress: TREASURY,
    initialSupplyWholeTokens: "100000000",
  });

  assert.equal(plan.network.chainId, 84532);
  assert.equal(plan.network.production, false);
  assert.equal(plan.initialSupplyWholeTokens, "100000000");
  assert.equal(plan.initialSupplyBaseUnits, "100000000000000000000000000");
  assert.equal(plan.broadcast, false);
  assert.equal(plan.signing.privateKeyStoredByHercules, false);
  assert.equal(plan.unsignedDeploymentData, null);
  assert.ok(plan.constructorArgsHex.startsWith("0x"));
  assert.equal(plan.constructorArgsHex.length, 2 + 64 + 64);
});

test("supports Ethereum Sepolia as a second public test network", () => {
  const plan = buildHurcDeploymentPlan({
    network: "ethereum-sepolia",
    treasuryAddress: TREASURY,
    initialSupplyWholeTokens: "1",
  });

  assert.equal(plan.network.chainId, 11155111);
  assert.equal(plan.initialSupplyBaseUnits, "1000000000000000000");
});

test("can append ABI-encoded constructor arguments to compiler creation bytecode", () => {
  const plan = buildHurcDeploymentPlan({
    network: "base-sepolia",
    treasuryAddress: TREASURY,
    initialSupplyWholeTokens: "10",
    compilerBytecode: "0x60006000",
  });

  assert.ok(plan.unsignedDeploymentData.startsWith("0x60006000"));
  assert.equal(
    plan.unsignedDeploymentData,
    "0x60006000" + plan.constructorArgsHex.slice(2),
  );
});

test("rejects missing, zero, malformed, or production-like deployment inputs", () => {
  assert.throws(
    () => buildHurcDeploymentPlan({
      network: "base-sepolia",
      treasuryAddress: "0x0000000000000000000000000000000000000000",
      initialSupplyWholeTokens: "1",
    }),
    /zero address/,
  );

  assert.throws(
    () => buildHurcDeploymentPlan({
      network: "base-sepolia",
      treasuryAddress: TREASURY,
      initialSupplyWholeTokens: "0",
    }),
    /positive whole-number/,
  );

  assert.throws(
    () => buildHurcDeploymentPlan({
      network: "ethereum-mainnet",
      treasuryAddress: TREASURY,
      initialSupplyWholeTokens: "1",
    }),
    /unsupported HURC test network/,
  );
});
