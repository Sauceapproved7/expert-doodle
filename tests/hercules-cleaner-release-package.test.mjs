import {buildCleanerReleaseManifest} from "../scripts/package-hercules-cleaner-release.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../releases/hercules-cleaner-v1.1.0/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

test("Cleaner v1.1.0 release contains installer, security, release notes and manifest", () => {
  for (const name of ["README.md","INSTALL.md","SECURITY.md","RELEASE-NOTES.md","release-manifest.json"]) {
    assert.equal(fs.existsSync(new URL(name, root)), true, name + " missing");
  }
  assert.equal(fs.existsSync(new URL("../HerculesCleaner-Setup.cmd", import.meta.url)), true, "one-click setup missing");
});

test("Cleaner release stays local-first, recovery-first and user-scoped", () => {
  const readme = read("README.md");
  const install = read("INSTALL.md");
  const security = read("SECURITY.md");
  assert.match(readme, /Session Clean/);
  assert.match(readme, /Recovery Capsules/);
  assert.match(readme, /Windows.*macOS.*Linux/is);
  assert.match(install, /one-click/i);
  assert.match(install, /user-scoped/i);
  assert.match(install, /preserv/i);
  assert.match(security, /loopback/i);
  assert.match(security, /protected/i);
  assert.match(security, /SHA-256/i);
  assert.doesNotMatch(readme, /registry optimization/i);
});

test("release manifest binds v1.1.0 Early Access without opening checkout", () => {
  const manifest = JSON.parse(read("release-manifest.json"));
  assert.equal(manifest.schema, "sauceapproved.hercules-cleaner.release");
  assert.equal(manifest.version, "1.1.0");
  assert.equal(manifest.releaseClass, "early_access");
  assert.equal(manifest.checkoutEnabled, false);
  assert.ok(manifest.sourceRoots.includes("hercules-cleaner/"));
  assert.ok(manifest.sourceRoots.includes("HerculesCleaner-Setup.cmd"));
});

test("exact-commit package manifest includes installer and updater sources", async () => {
  const manifest = await buildCleanerReleaseManifest({commitSha:"77093aceae5d5df5a3ae4d3947b607473ff15db9"});
  assert.equal(manifest.schema,"sauceapproved.hercules.cleaner.package.v1");
  assert.equal(manifest.product,"Hercules Cleaner");
  assert.equal(manifest.version,"1.1.0");
  assert.equal(manifest.releaseClass,"early_access");
  assert.equal(manifest.checkoutEnabled,false);
  assert.ok(manifest.files.some(item=>item.path==="HerculesCleaner-Setup.cmd"));
  assert.ok(manifest.files.some(item=>item.path==="hercules-cleaner/windows-installer.mjs"));
  assert.ok(manifest.files.some(item=>item.path==="hercules-cleaner/windows-installer-cli.mjs"));
  assert.match(manifest.aggregateSha256,/^[a-f0-9]{64}$/);
  for(const item of manifest.files){assert.match(item.sha256,/^[a-f0-9]{64}$/);assert.ok(item.bytes>0)}
});

test("release packager refuses unresolved source identity", async () => {
  await assert.rejects(()=>buildCleanerReleaseManifest({commitSha:"main"}),/resolved 40-character commit SHA required/);
});
