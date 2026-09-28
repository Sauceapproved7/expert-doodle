import test from "node:test";
import assert from "node:assert/strict";
import {buildSmokeScreenReleaseManifest} from "../scripts/package-smokescreen-release.mjs";

test("SmokeScreen public package includes canonical runtime and benchmark evidence", async()=>{
  const manifest=await buildSmokeScreenReleaseManifest({
    commitSha:"0f371ce837c78685694185e645ff0e39d2549b56",
  });

  assert.equal(manifest.product,"Hercules SmokeScreen Sentinel");
  assert.equal(manifest.version,"2.1.0");
  assert.equal(manifest.releaseClass,"public-community-preview");
  assert.equal(manifest.license,"Apache-2.0");
  assert.equal(manifest.defensiveOnly,true);
  assert.equal(manifest.outboundCounterattack,false);
  assert.equal(manifest.commercialCheckout,false);
  assert.equal(manifest.globalReadinessCoverageScore,64);
  assert.equal(manifest.syntheticFixture.hostileDetectionRate,1);
  assert.equal(manifest.syntheticFixture.falsePositiveDeceptionRate,0);
  assert.equal(manifest.syntheticFixture.productionDetectionRateClaim,false);

  const paths=new Set(manifest.files.map((item)=>item.path));
  for(const required of [
    "hercules-runtime/smokescreen-agent.mjs",
    "hercules-runtime/smokescreen-forge-ingress.mjs",
    "benchmarks/HERCULES-SMOKESCREEN-GLOBAL-BENCHMARK-2026-09-28.md",
    "docs/HERCULES-SMOKESCREEN-SENTINEL-V1.md",
    "docs/HERCULES-THREAT-MODEL.md",
    "LICENSE",
    "SECURITY.md",
  ]){
    assert.ok(paths.has(required),required+" must be packaged");
  }

  for(const file of manifest.files){
    assert.match(file.sha256,/^[a-f0-9]{64}$/);
    assert.ok(file.bytes>0);
  }
  assert.match(manifest.aggregateSha256,/^[a-f0-9]{64}$/);
});

test("public package refuses unresolved source identity", async()=>{
  await assert.rejects(
    ()=>buildSmokeScreenReleaseManifest({commitSha:"unresolved"}),
    /resolved 40-character commit SHA required/,
  );
});
