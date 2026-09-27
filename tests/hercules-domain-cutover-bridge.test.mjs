import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/domain-cutover/index.html", import.meta.url), "utf8");

test("domain bridge keeps provider verification in Spaceship", () => {
  assert.match(html, /Hercules Domain Cutover Bridge/);
  assert.match(html, /Authorize Spaceship/);
  assert.match(html, /Provider login and human verification stay on Spaceship/);
  assert.doesNotMatch(html, /type=["']password["']/i);
  assert.doesNotMatch(html, /api_secret|captcha.*bypass|cookie.*export/i);
});

test("domain bridge uses a short-lived official OAuth authorization only", () => {
  assert.match(html, /const AUTH_URL=/);
  assert.match(html, /const AUTH_EXPIRES_AT=/);
  assert.match(html, /window\.location\.assign\(AUTH_URL\)/);
  assert.match(html, /Authorization session expired/);
});

test("domain bridge verifies only the managed Shopify DNS records", () => {
  assert.match(html, /23\.227\.38\.65/);
  assert.match(html, /2620:0127:f00f:5::/);
  assert.match(html, /shops\.myshopify\.com/);
  assert.match(html, /dns\.google\/resolve/);
});

test("domain bridge performs a public HTTPS reachability probe", () => {
  assert.match(html, /https:\/\/sauceapproved\.com\//);
  assert.match(html, /mode:\s*["']no-cors["']/);
});
