import test from "node:test";
import assert from "node:assert/strict";
import {createCreationFloorWorkspace} from "./workspace.mjs";
test("Creation Floor workspace exposes the complete 1-10 production path",()=>{
 const w=createCreationFloorWorkspace({projectId:"p1",title:"Hercules Film",ownerId:"owner-1"});
 assert.deepEqual(w.flow,["project-hub","media-vault","timeline-editor","export-center","caption-transcript-lab","audio-workbench","project-time-machine","review-room","publishing-command-center","performance-feedback-loop"]);
 assert.equal(w.project.id,"p1"); assert.equal(w.gates.publish,"closed"); assert.equal(w.gates.externalAnalytics,"closed");
});
