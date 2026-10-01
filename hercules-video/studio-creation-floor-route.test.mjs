import test from "node:test";
import assert from "node:assert/strict";
import {createStudioServer} from "./studio-server.mjs";
test("Creation Floor manifest and UI are reachable through Studio server",async()=>{
 const server=createStudioServer();
 const manifest=await server.handle({method:"GET",pathname:"/api/studio/creation-floor/manifest"});
 assert.equal(manifest.status,200); assert.match(manifest.body,/hercules-creation-floor/);
 const page=await server.handle({method:"GET",pathname:"/creation-floor"});
 assert.equal(page.status,200); assert.match(page.body,/Creation/); assert.match(page.body,/Proof Spine/);
});
test("Creation Floor mutation surface remains absent by default",async()=>{
 const server=createStudioServer();
 const r=await server.handle({method:"POST",pathname:"/api/studio/creation-floor/project",body:"{}"});
 assert.notEqual(r.status,200);
});
