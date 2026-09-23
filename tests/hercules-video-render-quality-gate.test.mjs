import assert from "node:assert/strict";
import test from "node:test";
import {evaluateTechnicalMedia,createHerculesRenderQualityEvaluator} from "../hercules-video/render-quality-gate.mjs";

test("technical gate accepts Wan portrait geometry and duration",()=>{
  const result=evaluateTechnicalMedia({
    media:{width:704,height:1280,fps:24,durationSeconds:4.04},
    expectedAspectRatio:"9:16",
    expectedDurationSeconds:4,
    expectedFps:24,
  });
  assert.equal(result.passed,true);
});

test("technical gate rejects materially wrong aspect ratio",()=>{
  const result=evaluateTechnicalMedia({
    media:{width:1280,height:720,fps:24,durationSeconds:4},
    expectedAspectRatio:"9:16",
    expectedDurationSeconds:4,
  });
  assert.equal(result.passed,false);
  assert.equal(result.checks.aspectRatio,false);
});

test("quality evaluator fails closed before semantic scoring on technical failure",async()=>{
  let semanticCalls=0;
  const evaluator=createHerculesRenderQualityEvaluator({
    technicalProbe:async()=>({width:1280,height:720,fps:24,durationSeconds:4}),
    semanticEvaluator:async()=>{semanticCalls++;return {};},
  });
  await assert.rejects(()=>evaluator({
    shot:{id:"a",aspectRatio:"9:16",durationSeconds:4,audioStrategy:"post"},
    artifact:{uri:"file:///tmp/a.mp4",durationSeconds:4},
    request:{output:{fps:24}},
  }),/quality_technical_gate_failed:a/);
  assert.equal(semanticCalls,0);
});

test("post-audio render is not penalized for missing native audio quality",async()=>{
  const evaluator=createHerculesRenderQualityEvaluator({
    technicalProbe:async()=>({width:704,height:1280,fps:24,durationSeconds:4}),
    semanticEvaluator:async()=>({
      promptAdherence:.9,temporalConsistency:.9,visualQuality:.9,brandConsistency:.9,
      artifactFreedom:.9,reliability:.9,
    }),
  });
  const quality=await evaluator({
    shot:{id:"a",aspectRatio:"9:16",durationSeconds:4,audioStrategy:"post"},
    artifact:{uri:"file:///tmp/a.mp4",durationSeconds:4},
    request:{output:{fps:24}},
  });
  assert.equal(quality.audioQuality,1);
  assert.equal(quality.technicalPassed,true);
});

test("semantic dimensions remain bounded",async()=>{
  const evaluator=createHerculesRenderQualityEvaluator({
    technicalProbe:async()=>({width:704,height:1280,fps:24,durationSeconds:4}),
    semanticEvaluator:async()=>({
      promptAdherence:3,temporalConsistency:-2,visualQuality:.8,brandConsistency:.7,
      audioQuality:.5,artifactFreedom:.6,reliability:.9,
    }),
  });
  const quality=await evaluator({
    shot:{id:"a",aspectRatio:"9:16",durationSeconds:4,audioStrategy:"native"},
    artifact:{uri:"file:///tmp/a.mp4",durationSeconds:4},
    request:{output:{fps:24}},
  });
  assert.equal(quality.promptAdherence,1);
  assert.equal(quality.temporalConsistency,0);
  assert.equal(quality.audioQuality,.5);
});
