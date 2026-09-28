import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../releases/hercules-cleaner-v1.0.0/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

test("Cleaner release package contains install, security, release notes and manifest", () => {
  for (const name of ["README.md","INSTALL.md","SECURITY.md","RELEASE-NOTES.md","release-manifest.json"]) {
    assert.equal(fs.existsSync(new URL(name, root)), true, name + " missing");
  }
});

test("Cleaner release stays local-first and recovery-first", () => {
  const readme = read("README.md");
  const security = read("SECURITY.md");
  assert.match(readme, /Session Clean/);
  assert.match(readme, /Recovery Capsules/);
  assert.match(readme, /Windows.*macOS.*Linux/is);
  assert.match(security, /loopback/i);
  assert.match(security, /protected/i);
  assert.match(security, /SHA-256/i);
  assert.doesNotMatch(readme, /registry optimization/i);
});

test("release manifest binds the canonical cleaner runtime and exact release class", () => {
  const manifest = JSON.parse(read("release-manifest.json"));
  assert.equal(manifest.schema, "sauceapproved.hercules-cleaner.release");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.releaseClass, "early_access");
  assert.equal(manifest.checkoutEnabled, false);
  assert.ok(manifest.sourceRoots.includes("hercules-cleaner/"));
});
