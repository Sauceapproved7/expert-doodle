import test from "node:test";
import assert from "node:assert/strict";
import {createStudioHttpHandler} from "./studio-server.mjs";

test("Creation Floor manifest and UI are reachable through Studio server",async()=>{
  const handle=createStudioHttpHandler();
  const manifest=await handle({method:"GET",pathname:"/api/studio/creation-floor/manifest"});
  assert.equal(manifest.status,200);
  assert.match(manifest.body,/hercules-creation-floor/);
  const page=await handle({method:"GET",pathname:"/creation-floor"});
  assert.equal(page.status,200);
  assert.match(page.body,/Creation/);
  assert.match(page.body,/Proof Spine/);
});
test("Creation Floor renders functional editor workspace controls without pretending to render media",async()=>{
  const page=await createStudioHttpHandler()({method:"GET",pathname:"/creation-floor"});
  for(const marker of ["Project Hub","Media Vault","Timeline Editor","Add media","Split","Trim","Move","Export locked","Proof Spine"]) assert.match(page.body,new RegExp(marker));
  assert.match(page.body,/data-timeline-track/);
  assert.match(page.body,/data-clip/);
  assert.match(page.body,/viewport-fit=cover/);
  assert.doesNotMatch(page.body,/Export ready/);
});
test("Creation Floor mutation surface remains absent by default",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({method:"POST",pathname:"/api/studio/creation-floor/project",body:"{}"});
  assert.notEqual(response.status,200);
});
