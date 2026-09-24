import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateHurcDeployment} from "../scripts/validate-hurc-deployment.mjs";

const canonical = JSON.parse(await readFile(new URL("../hercules-hurc/deployment.json", import.meta.url), "utf8"));

test("canonical HURC manifest is valid and undeployed", () => {
  const result = validateHurcDeployment(canonical);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(canonical.deployment.status, "not-deployed");
});

test("undeployed state cannot silently contain deployment values", () => {
  const changed = structuredClone(canonical);
  changed.deployment.treasuryAddress = "0x1111111111111111111111111111111111111111";
  assert.equal(validateHurcDeployment(changed).ok, false);
});

test("deployment approval requires complete parameters", () => {
  const changed = structuredClone(canonical);
  changed.deployment = {
    status: "deployment-approved",
    chainId: 1,
    contractAddress: null,
    treasuryAddress: "0x1111111111111111111111111111111111111111",
    initialSupplyWholeTokens: 1000000,
    transactionHash: null,
    sourceCommit: "0123456789abcdef0123456789abcdef01234567"
  };
  assert.equal(validateHurcDeployment(changed).ok, true);
});

test("deployed state requires contract address and transaction hash", () => {
  const changed = structuredClone(canonical);
  Object.assign(changed.deployment, {
    status: "deployed",
    chainId: 1,
    treasuryAddress: "0x1111111111111111111111111111111111111111",
    initialSupplyWholeTokens: 1000000,
    sourceCommit: "0123456789abcdef0123456789abcdef01234567"
  });
  assert.equal(validateHurcDeployment(changed).ok, false);
});
