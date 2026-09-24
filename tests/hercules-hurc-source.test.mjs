import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile(new URL("../hercules-hurc/HURC.sol", import.meta.url), "utf8");

test("HURC is the canonical dependency-free token source", () => {
  assert.match(source, /contract\s+HURC\b/);
  assert.match(source, /"Hercules Coin"/);
  assert.match(source, /"HURC"/);
  assert.doesNotMatch(source, /^\s*import\s/m);
});

test("HURC exposes the ERC-20 transfer and allowance surface", () => {
  for (const fragment of [
    "event Transfer(",
    "event Approval(",
    "function transfer(",
    "function approve(",
    "function transferFrom(",
    "mapping(address => uint256) public balanceOf",
    "mapping(address => mapping(address => uint256)) public allowance",
  ]) {
    assert.ok(source.includes(fragment), "missing required token surface: " + fragment);
  }
});

test("HURC supply is created once and has no mint or privileged admin path", () => {
  assert.match(source, /uint256\s+public\s+immutable\s+totalSupply/);
  assert.match(source, /constructor\(address treasury, uint256 initialSupplyWholeTokens\)/);
  assert.doesNotMatch(source, /function\s+mint\s*\(/);
  assert.doesNotMatch(source, /function\s+upgrade/i);
  assert.doesNotMatch(source, /\bonlyOwner\b/);
  assert.doesNotMatch(source, /\bowner\s*=/);
});

test("HURC rejects zero treasury, zero supply, and zero transfer recipient", () => {
  assert.ok((source.match(/ZeroAddress\(\)/g) ?? []).length >= 3);
  assert.match(source, /initialSupplyWholeTokens\s*==\s*0/);
  assert.match(source, /to\s*==\s*address\(0\)/);
});
