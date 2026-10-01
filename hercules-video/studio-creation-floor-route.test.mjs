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

test("Creation Floor mutation surface remains absent by default",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({
    method:"POST",
    pathname:"/api/studio/creation-floor/project",
    body:"{}"
  });
  assert.notEqual(response.status,200);
});
