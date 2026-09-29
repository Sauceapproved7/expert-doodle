import assert from "node:assert/strict";
import test from "node:test";

import {createMovieMachineManifest,buildMovieBlueprint} from "../sauceapproved-studio/movie-machine/core.mjs";
import {createHoloStageManifest,buildStagePlan} from "../sauceapproved-studio/holostage/core.mjs";
import {createLegacyVaultManifest,buildLegacyFilmPlan} from "../sauceapproved-studio/legacy-vault/core.mjs";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";

test("Movie Machine exposes a premium cinematic planning surface with Hercules differentiators",()=>{
  const manifest=createMovieMachineManifest();
  assert.equal(manifest.product,"Hercules Movie Machine");
  assert.equal(manifest.executionPolicy,"plan-first-fail-closed");
  assert.equal(manifest.providerRequiredForRender,true);
  assert.ok(manifest.differentiators.includes("Continuity Spine"));
  assert.ok(manifest.differentiators.includes("Emotion-to-Camera Graph"));
  assert.ok(manifest.differentiators.includes("Director's Proof Map"));
});

test("Movie Machine turns one story brief into a traceable multi-act cinematic blueprint",()=>{
  const plan=buildMovieBlueprint({
    title:"The Last Jar",
    premise:"A family recipe becomes the bridge between two generations.",
    audience:"short-film viewers",
    targetMinutes:8,
    tone:"warm, grounded, cinematic"
  });
  assert.equal(plan.schema,"sauceapproved.studio.movie-machine.blueprint");
  assert.equal(plan.acts.length,3);
  assert.ok(plan.scenes.length>=6);
  assert.ok(plan.scenes.every(scene=>scene.continuityId));
  assert.ok(plan.scenes.every(scene=>scene.cameraIntent && scene.emotionalBeat));
  assert.equal(plan.renderReady,false);
  assert.equal(plan.providerStatus,"not-connected");
  assert.equal(plan.directorsProofMap.length,plan.scenes.length);
  assert.equal(plan.emotionCameraGraph.length,plan.scenes.length);
  assert.ok(plan.directorsProofMap.every(item=>item.status==="review-required"));
});

test("Movie Machine fails closed on incomplete story truth",()=>{
  assert.throws(()=>buildMovieBlueprint({title:"Untitled"}),/movie_brief_incomplete/);
});

test("HoloStage exposes a virtual production floor with two-plus Hercules differentiators",()=>{
  const manifest=createHoloStageManifest();
  assert.equal(manifest.product,"Hercules HoloStage");
  assert.equal(manifest.executionPolicy,"simulation-only-until-authorized");
  assert.equal(manifest.liveControlEnabled,false);
  assert.ok(manifest.differentiators.includes("One-Take Stress Test"));
  assert.ok(manifest.differentiators.includes("Spatial Continuity Lock"));
  assert.ok(manifest.differentiators.includes("Camera-Light Collision Guard"));
});

test("HoloStage builds blocking, camera and lighting choreography without claiming live execution",()=>{
  const plan=buildStagePlan({
    title:"Night Market Reveal",
    stageWidth:12,
    stageDepth:10,
    subjects:["host","product table","background performer"],
    beats:["enter","reveal","close"]
  });
  assert.equal(plan.schema,"sauceapproved.studio.holostage.plan");
  assert.equal(plan.mode,"virtual-production-plan");
  assert.equal(plan.liveExecution,false);
  assert.ok(plan.cameraPath.length>=3);
  assert.ok(plan.lightCues.length>=3);
  assert.ok(plan.blocking.length>=3);
  assert.equal(plan.safety.collisionsDetected,0);
  assert.equal(plan.oneTakeStressTest.pass,true);
});

test("HoloStage collision guard and one-take stress test expose physical-plan failures",()=>{
  const plan=buildStagePlan({
    title:"Tight Stage",
    stageWidth:8,
    stageDepth:8,
    subjects:["host"],
    beats:["one","two","three"],
    maxContinuousMoveMeters:0.25,
    lights:[{id:"key-1",x:1,z:7}]
  });
  assert.equal(plan.oneTakeStressTest.pass,false);
  assert.ok(plan.safety.collisionsDetected>0);
  assert.ok(plan.safety.collisions.some(item=>item.kind==="camera-light"));
});

test("HoloStage rejects impossible stage geometry",()=>{
  assert.throws(()=>buildStagePlan({title:"Bad",stageWidth:0,stageDepth:10,subjects:["host"],beats:["go"]}),/stage_geometry_invalid/);
});

test("Legacy Vault exposes privacy-first documentary storytelling with provenance controls",()=>{
  const manifest=createLegacyVaultManifest();
  assert.equal(manifest.product,"Hercules Legacy Vault");
  assert.equal(manifest.executionPolicy,"consent-and-provenance-gated");
  assert.equal(manifest.autoPublish,false);
  assert.ok(manifest.differentiators.includes("Memory Provenance Chain"));
  assert.ok(manifest.differentiators.includes("Consent Horizon"));
  assert.ok(manifest.differentiators.includes("Generational Story Weave"));
});

test("Legacy Vault builds a documentary plan from approved memories while preserving source lineage",()=>{
  const plan=buildLegacyFilmPlan({
    title:"Family Sauce",
    subject:"The Carter family recipe",
    approvedSources:[
      {id:"photo-1",type:"photo",label:"Grandmother in the kitchen",approved:true},
      {id:"voice-1",type:"voice-note",label:"Recipe story",approved:true},
      {id:"clip-1",type:"video",label:"Sunday dinner",approved:true}
    ],
    chapters:["Origins","The Recipe","Passing It Down"]
  });
  assert.equal(plan.schema,"sauceapproved.studio.legacy-vault.film-plan");
  assert.equal(plan.publishReady,false);
  assert.equal(plan.sourceLedger.length,3);
  assert.ok(plan.chapters.every(chapter=>chapter.sourceIds.length>0));
  assert.ok(plan.reviewGates.includes("consent"));
  assert.ok(plan.reviewGates.includes("privacy"));
  assert.ok(plan.reviewGates.includes("provenance"));
  assert.equal(plan.sourceLedger[0].consentHorizon.publicUse,false);
  assert.ok(plan.memoryProvenanceChain.every(item=>item.sourceType));
});

test("Legacy Vault preserves source-specific consent horizons",()=>{
  const plan=buildLegacyFilmPlan({
    title:"Private Family Cut",
    subject:"Family archive",
    approvedSources:[{
      id:"voice-9",
      type:"voice-note",
      label:"Private memory",
      approved:true,
      consent:{allowedUses:["private-edit"],publicUse:false,expiresAt:"2030-01-01"}
    }],
    chapters:["Origins"]
  });
  assert.deepEqual(plan.sourceLedger[0].consentHorizon.allowedUses,["private-edit"]);
  assert.equal(plan.sourceLedger[0].consentHorizon.publicUse,false);
  assert.equal(plan.sourceLedger[0].consentHorizon.expiration,"2030-01-01");
});

test("Legacy Vault refuses unapproved source material",()=>{
  assert.throws(()=>buildLegacyFilmPlan({
    title:"Family Sauce",
    subject:"Family story",
    approvedSources:[{id:"x",type:"photo",label:"private",approved:false}],
    chapters:["Origins"]
  }),/unapproved_source_material/);
});

test("Studio exposes all three new flagship surfaces and manifests",async()=>{
  const handle=createStudioHttpHandler();
  for (const [route,label,api] of [
    ["/movie-machine","Hercules Movie Machine","/api/studio/movie-machine/manifest"],
    ["/holostage","Hercules HoloStage","/api/studio/holostage/manifest"],
    ["/legacy-vault","Hercules Legacy Vault","/api/studio/legacy-vault/manifest"]
  ]) {
    const page=await handle({method:"GET",pathname:route});
    assert.equal(page.status,200);
    assert.match(page.body,new RegExp(label));
    const manifest=await handle({method:"GET",pathname:api});
    assert.equal(manifest.status,200);
  }

  const root=await handle({method:"GET",pathname:"/"});
  assert.match(root.body,/href="\/movie-machine"/);
  assert.match(root.body,/href="\/holostage"/);
  assert.match(root.body,/href="\/legacy-vault"/);

  const studio=JSON.parse((await handle({method:"GET",pathname:"/api/studio/manifest"})).body);
  for (const id of ["movie-machine","holostage","legacy-vault"]) {
    assert.ok(studio.surfaces.some(surface=>surface.id===id),id);
  }
});
