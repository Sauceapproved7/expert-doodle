import test from "node:test";
import assert from "node:assert/strict";
import {createCreationFloorManifest,buildCreationFloorProject} from "./core.mjs";

test("manifest covers all ten Studio expansion systems",()=>{
  const manifest=createCreationFloorManifest();
  assert.equal(manifest.systems.length,10);
  assert.deepEqual(manifest.systems.map(x=>x.id),[
    "project-hub","media-vault","timeline-editor","export-center","caption-transcript-lab",
    "audio-workbench","project-time-machine","review-room","publishing-command-center","performance-feedback-loop"
  ]);
});

test("project starts fail-closed for export publishing and analytics",()=>{
  const project=buildCreationFloorProject({title:"Launch Film",ownerId:"owner-1"});
  assert.equal(project.title,"Launch Film");
  assert.equal(project.controls.export.enabled,false);
  assert.equal(project.controls.publish.enabled,false);
  assert.equal(project.controls.analytics.enabled,false);
  assert.equal(project.version,1);
  assert.equal(project.assets.length,0);
});

test("project requires title and owner identity",()=>{
  assert.throws(()=>buildCreationFloorProject({title:"",ownerId:"owner-1"}),/creation_floor_project_identity_required/);
  assert.throws(()=>buildCreationFloorProject({title:"Film",ownerId:""}),/creation_floor_project_identity_required/);
});
