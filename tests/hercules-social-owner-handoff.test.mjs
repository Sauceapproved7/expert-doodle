import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const ui = await readFile(new URL("../supabase/functions/hercules-integrations/index.ts", import.meta.url), "utf8");

test("DA-24 social owner handoff exposes LinkedIn and Metricool without credential capture", () => {
  assert.match(ui, /<h2>SauceApproved Social<\/h2>/);
  assert.match(ui, /data-linear-issue="DA-24"/);
  assert.match(ui, /https:\/\/www\.linkedin\.com\/company\/setup\/new\//);
  assert.match(ui, /https:\/\/app\.metricool\.com\/brands\/connections\?blogId=6894246/);
  assert.match(ui, /target="_blank"/);
  assert.match(ui, /rel="noopener noreferrer"/);
  assert.match(ui, /No passwords, cookies, session tokens, MFA codes, or Vault material are collected here\./);
});

test("DA-24 handoff preserves owner-only and automatable work boundaries", () => {
  assert.match(ui, /Owner action/);
  assert.match(ui, /Automated after authorization/);
  assert.match(ui, /Create\/verify the SauceApproved LinkedIn Company Page and accept LinkedIn-required terms or verification\./);
  assert.match(ui, /Authorize Metricool and select the SauceApproved Company Page\./);
  assert.match(ui, /Verify the Metricool connection and scheduling availability, then record completion evidence in DA-24\./);
  assert.match(ui, /No post is published by this handoff\./);
});

test("DA-24 handoff exposes only the prepared public company-page package", () => {
  assert.match(ui, /SauceApproved enterprise LLC/);
  assert.match(ui, /Software Development/);
  assert.match(ui, /Privately Held/);
  assert.match(ui, /Verifiable AI software that helps businesses recover cash, keep control, and prove every action\./);
  assert.match(ui, /https:\/\/sauceapproved\.com\/\?utm_source=linkedin&amp;utm_medium=organic_social&amp;utm_campaign=founding-pilot-organic-v1&amp;utm_content=company-page/);
});
