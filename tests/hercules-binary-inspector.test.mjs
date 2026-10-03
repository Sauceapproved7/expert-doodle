import test from "node:test";
import assert from "node:assert/strict";
import { inspectBinary } from "../hercules-binary-inspector/index.mjs";

test("fails closed without authorization", () => {
  assert.throws(() => inspectBinary(Buffer.from("MZ")), /authorization_required/);
});

test("identifies PE and emits deterministic SHA-256 evidence", () => {
  const sample = Buffer.from("MZ\x00\x00hello-world");
  const report = inspectBinary(sample, { authorized: true });
  assert.equal(report.evidence.format, "PE");
  assert.match(report.evidence.sha256, /^[a-f0-9]{64}$/);
  assert.equal(report.execution, "not_performed");
  assert.equal(report.mutations, "not_performed");
});

test("rejects empty and oversized inputs", () => {
  assert.throws(() => inspectBinary(Buffer.alloc(0), { authorized: true }), /empty_binary/);
  assert.throws(() => inspectBinary(Buffer.alloc(9), { authorized: true, maxBytes: 8 }), /binary_too_large/);
});
