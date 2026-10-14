import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../hercules-forge/offers/sauceapproved-studio/index.html", import.meta.url), "utf8");

test("Studio offer provides a keyboard skip link and one main landmark", () => {
  assert.match(page, /<a class="skip-link" href="#main">Skip to content<\/a>/);
  assert.match(page, /<main id="main">/);
  assert.match(page, /<\/main>/);
  assert.match(page, /:focus-visible/);
});

test("Studio offer explains two concrete Hercules differentiators without unsupported guarantees", () => {
  assert.match(page, /<section class="reasons" aria-labelledby="why-studio">/);
  assert.match(page, /<h2 id="why-studio">/);
  assert.match(page, /Evidence-backed production/);
  assert.match(page, /Owner-controlled release/);
  assert.doesNotMatch(page, /guaranteed results|number one in the world/i);
});

test("Studio lead capture is explicitly labeled and announces submission results", () => {
  for (const id of ["plan", "email", "full_name", "company", "role", "message"]) {
    assert.match(page, new RegExp('<label for="' + id + '">'));
    assert.match(page, new RegExp('id="' + id + '"'));
  }
  assert.match(page, /id="msg"[^>]*role="status"[^>]*aria-live="polite"/);
});

test("Studio checkout and submission boundaries remain unchanged", () => {
  assert.match(page, /\/functions\/v1\/hercules-launch/);
  assert.match(page, /software_access_request/);
  assert.match(page, /No payment is collected/);
  assert.match(page, /Prices shown are planned launch pricing/);
  assert.doesNotMatch(page, /<script[^>]+src=/);
});
