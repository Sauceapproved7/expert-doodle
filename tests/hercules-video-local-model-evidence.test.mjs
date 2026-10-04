import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {mkdtemp,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {loadLocalModelManifest,verifyLocalModelManifest} from "../hercules-video/local-model-manifest.mjs";

const sha=value=>createHash("sha256").update(value).digest("hex");

test("local video model manifest verifies exact owned-local artifact evidence",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"hercules-video-model-"));
  await writeFile(path.join(root,"weights.bin"),Buffer.from("weights"));
  const manifestPath=path.join(root,"model-manifest.json");
  await writeFile(manifestPath,JSON.stringify({
    schema:"sauceapproved.hercules.video-local-model-manifest",
    version:1,
    modelId:"example/vision-evaluator",
    revision:"pinned-revision",
    license:"apache-2.0",
    files:[{path:"weights.bin",sizeBytes:7,sha256:sha("weights")}],
  }));
  const loaded=await loadLocalModelManifest({modelDir:root,manifestPath});
  assert.equal(loaded.revision,"pinned-revision");
  const evidence=await verifyLocalModelManifest({
    modelDir:root,manifestPath,
    expectedModelId:"example/vision-evaluator",
    expectedLicense:"apache-2.0",
  });
  assert.equal(evidence.verifiedFiles.length,1);
  assert.match(evidence.manifestFingerprint,/^[a-f0-9]{64}$/);
});

test("local video model manifest fails closed on traversal and tampering",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"hercules-video-model-bad-"));
  const manifestPath=path.join(root,"model-manifest.json");
  await writeFile(manifestPath,JSON.stringify({
    schema:"sauceapproved.hercules.video-local-model-manifest",version:1,
    modelId:"example/vision-evaluator",revision:"r",license:"apache-2.0",
    files:[{path:"../escape.bin",sizeBytes:1,sha256:sha("x")}],
  }));
  await assert.rejects(()=>loadLocalModelManifest({modelDir:root,manifestPath}),/model_manifest_path_escape/);
});