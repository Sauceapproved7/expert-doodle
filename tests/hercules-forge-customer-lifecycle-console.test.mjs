import test from "node:test";
import assert from "node:assert/strict";
import {
  customerConsoleHtml,
  customerConsoleJs,
} from "../hercules-forge/customer-console.mjs";

test("customer console exposes invite and recovery flows without persistent token storage", () => {
  const html = customerConsoleHtml();
  const js = customerConsoleJs();

  assert.match(html, /Forgot password/);
  assert.match(html, /id="lifecyclePanel"/);
  assert.match(html, /Invite member/);

  assert.match(js, /location\.hash/);
  assert.match(js, /history\.replaceState/);
  assert.match(js, /\/v1\/invites\/accept/);
  assert.match(js, /\/v1\/recovery\/request/);
  assert.match(js, /\/v1\/recovery\/complete/);
  assert.match(js, /\/invites/);
  assert.equal(js.includes("localStorage"), false);
  assert.equal(js.includes("sessionStorage"), false);
  assert.match(js, /If that account exists, a recovery link has been sent\./);
});
