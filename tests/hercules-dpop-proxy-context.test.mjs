import test from "node:test";
import assert from "node:assert/strict";
import { canonicalExternalRequest } from "../hercules-chat/dpop-request-context.mjs";

test("uses the actual request URL when no forwarding metadata is present", () => {
  const request = new Request("https://api.example.com/v1/payments?preview=true", { method: "POST" });
  assert.deepEqual(canonicalExternalRequest(request), {
    method: "POST",
    uri: "https://api.example.com/v1/payments",
  });
});

test("ignores query and fragment components for DPoP htu", () => {
  const request = new Request("https://api.example.com/v1/payments?tenant=a", { method: "GET" });
  assert.equal(canonicalExternalRequest(request).uri, "https://api.example.com/v1/payments");
});

test("rejects client-supplied forwarding headers instead of trusting them", () => {
  const request = new Request("http://internal:8080/internal/payments", {
    method: "POST",
    headers: { "x-forwarded-host": "api.example.com", "x-forwarded-proto": "https" },
  });
  assert.throws(() => canonicalExternalRequest(request), /UNTRUSTED_FORWARDING_CONTEXT/);
});

test("rejects conflicting Forwarded metadata", () => {
  const request = new Request("https://api.example.com/v1/payments", {
    headers: { forwarded: "for=1.2.3.4;proto=https;host=api.example.com, for=5.6.7.8;proto=http;host=evil.example" },
  });
  assert.throws(() => canonicalExternalRequest(request), /UNTRUSTED_FORWARDING_CONTEXT/);
});

test("rejects ambiguous host/path rewriting headers", () => {
  const request = new Request("https://api.example.com/v1/payments", {
    headers: { "x-forwarded-prefix": "/internal" },
  });
  assert.throws(() => canonicalExternalRequest(request), /UNTRUSTED_FORWARDING_CONTEXT/);
});
