import {buildCleanerReleaseManifest} from "../scripts/package-hercules-cleaner-release.mjs";
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


test("exact-commit package manifest hashes canonical release inputs", async () => {
  const manifest = await buildCleanerReleaseManifest({commitSha:"77093aceae5d5df5a3ae4d3947b607473ff15db9"});
  assert.equal(manifest.schema,"sauceapproved.hercules.cleaner.package.v1");
  assert.equal(manifest.product,"Hercules Cleaner");
  assert.equal(manifest.version,"1.0.0");
  assert.equal(manifest.releaseClass,"early_access");
  assert.equal(manifest.checkoutEnabled,false);
  assert.match(manifest.aggregateSha256,/^[a-f0-9]{64}$/);
  for(const item of manifest.files){assert.match(item.sha256,/^[a-f0-9]{64}$/);assert.ok(item.bytes>0)}
});

test("release packager refuses unresolved source identity", async () => {
  await assert.rejects(()=>buildCleanerReleaseManifest({commitSha:"main"}),/resolved 40-character commit SHA required/);
});
