import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const server = await readFile(new URL("../render/hercules-browser-standalone/server.mjs", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../render/hercules-browser-standalone/package.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../render/hercules-browser-standalone/public/manifest.webmanifest", import.meta.url), "utf8"));
const html = await readFile(new URL("../render/hercules-browser-standalone/public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../render/hercules-browser-standalone/public/app.js", import.meta.url), "utf8");
const sw = await readFile(new URL("../render/hercules-browser-standalone/public/sw.js", import.meta.url), "utf8");

test("standalone browser owns Chromium and has no Opera dependency", () => {
  assert.equal(pkg.dependencies["playwright-core"], "1.63.0");
  assert.match(server, /chromium\.launch\(/);
  assert.doesNotMatch(server, /Opera|Browser Connector|opera:/i);
  assert.doesNotMatch(app, /Opera|Browser Connector|opera:/i);
});

test("PWA is installable as a standalone Hercules Browser app", () => {
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.name, "Hercules Browser");
  assert.equal(manifest.start_url, "/");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /Hercules Browser/);
  assert.match(app, /serviceWorker\.register/);
  assert.match(sw, /CACHE_NAME/);
});

test("owner access uses brokered one-time claims and local HttpOnly sessions", () => {
  assert.doesNotMatch(server, /HERCULES_BROWSER_OWNER_KEY|HERCULES_BROWSER_RUNTIME_TOKEN/);
  assert.match(server, /uiSessions/);
  assert.match(server, /HttpOnly/);
  assert.match(server, /SameSite=Strict/);
  assert.match(server, /Secure/);
  assert.match(server, /randomBytes\(/);
  assert.match(server, /remoteAuthorized/);
  assert.doesNotMatch(html, /HERCULES_BROWSER_OWNER_KEY|HERCULES_BROWSER_RUNTIME_TOKEN/);
  assert.doesNotMatch(app, /HERCULES_BROWSER_OWNER_KEY|HERCULES_BROWSER_RUNTIME_TOKEN/);
});

test("browser UI supports real navigation and live remote control", () => {
  assert.match(server, /\/api\/navigate/);
  assert.match(server, /\/api\/frame/);
  assert.match(server, /\/api\/action/);
  assert.match(server, /\/api\/status/);
  assert.match(server, /page\.screenshot/);
  assert.match(server, /page\.mouse\.click/);
  assert.match(server, /page\.keyboard\.insertText/);
  assert.match(server, /page\.keyboard\.press/);
  assert.match(server, /page\.mouse\.wheel/);
  assert.match(app, /pointerdown|click/);
  assert.match(app, /navigate/);
});

test("autopilot is fail-closed around owner-controlled security fields", () => {
  assert.match(server, /function ownerControlledField/);
  assert.match(server, /password/i);
  assert.match(server, /one-time-code|otp/i);
  assert.match(server, /captcha/i);
  assert.match(server, /mfa/i);
  assert.match(server, /terms/i);
  assert.match(server, /consent/i);
  assert.match(server, /owner_action_required/);
  assert.match(server, /antiBotBypass:false/);
  assert.doesNotMatch(server, /bypassCaptcha|bypassCloudflare|antiBotBypass:true/i);
});

test("autopilot supports bounded retries and durable intent metadata", () => {
  assert.match(server, /AUTOPILOT_MAX_STEPS/);
  assert.match(server, /AUTOPILOT_MAX_RETRIES/);
  assert.match(server, /autopilotRun/);
  assert.match(server, /intentId/);
  assert.match(server, /resumeToken/);
  assert.match(server, /lastCheckpoint/);
  assert.match(server, /owner_action_required/);
});

test("network policy blocks private and credential-bearing targets", () => {
  assert.match(server, /private_target_blocked/);
  assert.match(server, /embedded_credentials_blocked/);
  assert.match(server, /unsupported_protocol/);
  assert.match(server, /networkAllowed/);
});


test("owner bootstrap keeps the secret out of request URLs", () => {
  assert.match(server, /\/api\/claim/);
  assert.match(app, /location\.hash/);
  assert.match(app, /history\.replaceState/);
  assert.match(app, /fetch\(["']\/api\/claim/);
  assert.doesNotMatch(server, /searchParams\.get\(["']access["']\)/);
  assert.doesNotMatch(server, /pathname===["']\/claim["']/);
});


test("server-to-server automation verifies one-time broker tokens remotely", () => {
  assert.match(server, /AUTH_VERIFY_URL/);
  assert.match(server, /authorization/i);
  assert.match(server, /Bearer /);
  assert.match(server, /remoteAuthorized/);
  assert.match(server, /fetch\(AUTH_VERIFY_URL/);
  assert.match(server, /ownerAuthorized\(req\).*remoteAuthorized\(req\)|remoteAuthorized\(req\).*ownerAuthorized\(req\)/s);
  assert.doesNotMatch(server, /HERCULES_BROWSER_RUNTIME_TOKEN/);
  assert.doesNotMatch(html, /HERCULES_BROWSER_RUNTIME_TOKEN/);
  assert.doesNotMatch(app, /HERCULES_BROWSER_RUNTIME_TOKEN/);
});
