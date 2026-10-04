import test from "node:test";
import assert from "node:assert/strict";
import {inspectBinary} from "../hercules-binary-inspector/index.mjs";

test("fails closed without authorization", () => {
  assert.throws(() => inspectBinary(Buffer.from("MZ")), /authorization_required/);
});

test("identifies PE and emits deterministic read-only SHA-256 evidence", () => {
  const sample = Buffer.from("MZ\x00\x00hello-world");
  const report = inspectBinary(sample, {authorized:true});
  assert.equal(report.schema, "hercules.binary-inspector.v1");
  assert.equal(report.evidence.format, "PE");
  assert.match(report.evidence.sha256, /^[a-f0-9]{64}$/);
  assert.equal(report.execution, "not_performed");
  assert.equal(report.mutations, "not_performed");
});

test("bounds input and printable-string extraction", () => {
  assert.throws(() => inspectBinary(Buffer.alloc(0), {authorized:true}), /empty_binary/);
  assert.throws(() => inspectBinary(Buffer.alloc(9), {authorized:true,maxBytes:8}), /binary_too_large/);

  const report=inspectBinary(Buffer.from("MZ\x00\x00alpha beta gamma delta"), {
    authorized:true,
    maxStrings:1,
  });
  assert.equal(report.evidence.strings.length,1);
  assert.ok(report.evidence.strings[0].value.length<=512);
});

test("rejects invalid inspection bounds instead of interpreting them loosely", () => {
  const sample=Buffer.from("MZ\x00\x00hello");
  for (const maxBytes of [0,-1,1.5,Number.NaN,Number.POSITIVE_INFINITY]) {
    assert.throws(() => inspectBinary(sample,{authorized:true,maxBytes}), /max_bytes_invalid/);
  }
  for (const maxStrings of [-1,1.5,Number.NaN,Number.POSITIVE_INFINITY,10001]) {
    assert.throws(() => inspectBinary(sample,{authorized:true,maxStrings}), /max_strings_invalid/);
  }
});
