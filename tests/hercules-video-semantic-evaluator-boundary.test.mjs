import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {createHerculesRenderQualityEvaluator} from "../hercules-video/render-quality-gate.mjs";
import {createLocalVisionEvaluationModelManifest} from "../hercules-video/evaluators/local-vision-model-plane.mjs";
import {HerculesModelRegistry} from "../hercules-models/registry.mjs";
import {HerculesModelRouter} from "../hercules-models/router.mjs";

const sha=value=>createHash("sha256").update(value).digest("hex");

test("render quality gate preserves bounded semantic evidence",async()=>{
  const evidence={fingerprint:sha("semantic"),modelId:"local-vision-evaluator",revision:"r1"};
  const gate=createHerculesRenderQualityEvaluator({
    technicalProbe:async()=>({width:720,height:1280,fps:24,durationSeconds:4}),
    semanticEvaluator:async()=>({
      promptAdherence:.9,temporalConsistency:.9,visualQuality:.9,brandConsistency:.9,
      artifactFreedom:.9,reliability:.9,evidence,
    }),
  });
  const result=await gate({
    shot:{id:"hero",aspectRatio:"9:16",durationSeconds:4,audioStrategy:"post"},
    artifact:{uri:"file:///tmp/hero.mp4",durationSeconds:4},
    request:{output:{fps:24}},
  });
  assert.deepEqual(result.semanticEvidence,evidence);
});

test("open-weight evaluator manifest is candidate-only and native routing rejects it",()=>{
  const model=createLocalVisionEvaluationModelManifest({
    id:"local-vision-evaluator",
    family:"local-vision",
    checkpoint:"local://models/vision",
    provenance:"verified-local-model-evidence:"+sha("manifest"),
  });
  assert.equal(model.origin,"open-weight");
  assert.equal(model.state,"candidate");
  assert.deepEqual(model.tasks,["vision"]);

  const registry=new HerculesModelRegistry([model]);
  assert.throws(()=>new HerculesModelRouter(registry,{nativeOnly:true}).route({
    task:"vision",mode:"evaluation",modelId:model.id,
  }),/native-only policy rejected model/);

  const routed=new HerculesModelRouter(registry,{nativeOnly:false}).route({
    task:"vision",mode:"evaluation",modelId:model.id,
  });
  assert.equal(routed.id,model.id);
});