import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {mkdtemp,writeFile} from "node:fs/promises";
import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import os from "node:os";
import path from "node:path";
import {
  loadLocalModelManifest,
  verifyLocalModelManifest,
} from "../hercules-video/local-model-manifest.mjs";
import {createQwen3Vl4bSemanticEvaluator} from "../hercules-video/evaluators/qwen3-vl-4b.mjs";
import {createHerculesRenderQualityEvaluator} from "../hercules-video/render-quality-gate.mjs";

const sha=value=>createHash("sha256").update(value).digest("hex");

test("local model manifest verifies exact files and hashes",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"hercules-qwen-model-"));
  const weights=path.join(root,"weights.bin");
  await writeFile(weights,Buffer.from("weights"));
  const manifestPath=path.join(root,"model-manifest.json");
  await writeFile(manifestPath,JSON.stringify({
    schema:"sauceapproved.hercules.video-local-model-manifest",
    version:1,
    modelId:"Qwen/Qwen3-VL-4B-Instruct",
    revision:"70c41a926abfc92501c4a4da369a8d6312915b61",
    license:"apache-2.0",
    files:[{path:"weights.bin",sizeBytes:7,sha256:sha("weights")}],
  }));
  const loaded=await loadLocalModelManifest({modelDir:root,manifestPath});
  assert.equal(loaded.modelId,"Qwen/Qwen3-VL-4B-Instruct");
  const evidence=await verifyLocalModelManifest({
    modelDir:root,
    manifestPath,
    expectedModelId:"Qwen/Qwen3-VL-4B-Instruct",
    expectedLicense:"apache-2.0",
  });
  assert.equal(evidence.verifiedFiles.length,1);
  assert.match(evidence.fingerprint,/^[a-f0-9]{64}$/);
});

test("local model manifest rejects path traversal and tampered files",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"hercules-qwen-bad-"));
  const manifestPath=path.join(root,"model-manifest.json");
  await writeFile(manifestPath,JSON.stringify({
    schema:"sauceapproved.hercules.video-local-model-manifest",
    version:1,
    modelId:"Qwen/Qwen3-VL-4B-Instruct",
    revision:"r",
    license:"apache-2.0",
    files:[{path:"../escape.bin",sizeBytes:1,sha256:sha("x")}],
  }));
  await assert.rejects(()=>loadLocalModelManifest({modelDir:root,manifestPath}),/model_manifest_path_escape/);

  const weights=path.join(root,"weights.bin");
  await writeFile(weights,"tampered");
  await writeFile(manifestPath,JSON.stringify({
    schema:"sauceapproved.hercules.video-local-model-manifest",
    version:1,
    modelId:"Qwen/Qwen3-VL-4B-Instruct",
    revision:"r",
    license:"apache-2.0",
    files:[{path:"weights.bin",sizeBytes:8,sha256:sha("expected")}],
  }));
  await assert.rejects(()=>verifyLocalModelManifest({
    modelDir:root,
    manifestPath,
    expectedModelId:"Qwen/Qwen3-VL-4B-Instruct",
    expectedLicense:"apache-2.0",
  }),/model_manifest_file_hash_mismatch/);
});

function fakeSpawnWith(response) {
  return () => {
    const child=new EventEmitter();
    child.stdin=new PassThrough();
    child.stdout=new PassThrough();
    child.stderr=new PassThrough();
    child.kill=()=>{};
    let body="";
    child.stdin.on("data",chunk=>{body+=chunk.toString();});
    child.stdin.on("end",()=>{
      const request=JSON.parse(body);
      const payload=typeof response==="function" ? response(request) : response;
      child.stdout.write(JSON.stringify(payload));
      child.stdout.end();
      queueMicrotask(()=>child.emit("close",0));
    });
    return child;
  };
}

test("Qwen evaluator returns bounded Hercules semantic scores and evidence",async()=>{
  const evaluator=createQwen3Vl4bSemanticEvaluator({
    modelDir:"/models/qwen3-vl-4b",
    manifestPath:"/models/qwen3-vl-4b/model-manifest.json",
    workerPath:"/repo/qwen3_vl_worker.py",
    verifyManifest:async()=>({
      modelId:"Qwen/Qwen3-VL-4B-Instruct",
      revision:"70c41a926abfc92501c4a4da369a8d6312915b61",
      license:"apache-2.0",
      manifestFingerprint:sha("manifest"),
    }),
    statImpl:async()=>({isFile:()=>true,size:100}),
    spawnImpl:fakeSpawnWith(request=>({
      ok:true,
      modelId:request.modelId,
      modelRevision:request.modelRevision,
      sampledFps:request.sampleFps,
      scores:{
        promptAdherence:.95,
        temporalConsistency:.91,
        visualQuality:.94,
        brandConsistency:.96,
        artifactFreedom:.93,
        reliability:.9,
      },
      notes:["UI text is stable","motion is coherent"],
    })),
  });
  assert.equal(evaluator.herculesSemanticEvaluator,true);
  const result=await evaluator({
    shot:{id:"hero",prompt:"premium Hercules control interface",audioStrategy:"post"},
    artifact:{uri:"file:///tmp/hero.mp4",sha256:sha("video")},
    technical:{passed:true},
  });
  assert.equal(result.brandConsistency,.96);
  assert.equal(result.evidence.modelRevision,"70c41a926abfc92501c4a4da369a8d6312915b61");
  assert.equal(result.evidence.videoSha256,sha("video"));
  assert.match(result.evidence.fingerprint,/^[a-f0-9]{64}$/);
});

test("Qwen evaluator rejects out-of-range model scores",async()=>{
  const evaluator=createQwen3Vl4bSemanticEvaluator({
    modelDir:"/models/qwen3-vl-4b",
    manifestPath:"/models/qwen3-vl-4b/model-manifest.json",
    workerPath:"/repo/qwen3_vl_worker.py",
    verifyManifest:async()=>({revision:"r",manifestFingerprint:sha("manifest")}),
    statImpl:async()=>({isFile:()=>true,size:100}),
    spawnImpl:fakeSpawnWith({
      ok:true,
      scores:{
        promptAdherence:2,
        temporalConsistency:.9,
        visualQuality:.9,
        brandConsistency:.9,
        artifactFreedom:.9,
        reliability:.9,
      },
    }),
  });
  await assert.rejects(()=>evaluator({
    shot:{id:"x",prompt:"x",audioStrategy:"post"},
    artifact:{uri:"file:///tmp/x.mp4",sha256:sha("x")},
  }),/qwen_evaluator_score_invalid:promptAdherence/);
});

test("Hercules quality gate preserves semantic evaluator evidence",async()=>{
  const semanticEvidence={fingerprint:sha("semantic")};
  const gate=createHerculesRenderQualityEvaluator({
    technicalProbe:async()=>({width:704,height:1280,fps:24,durationSeconds:4}),
    semanticEvaluator:async()=>({
      promptAdherence:.9,
      temporalConsistency:.9,
      visualQuality:.9,
      brandConsistency:.9,
      artifactFreedom:.9,
      reliability:.9,
      evidence:semanticEvidence,
    }),
  });
  const result=await gate({
    shot:{id:"a",aspectRatio:"9:16",durationSeconds:4,audioStrategy:"post"},
    artifact:{uri:"file:///tmp/a.mp4",durationSeconds:4},
    request:{output:{fps:24}},
  });
  assert.deepEqual(result.semanticEvidence,semanticEvidence);
});
