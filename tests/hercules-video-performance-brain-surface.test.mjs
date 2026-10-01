import test from "node:test";
import assert from "node:assert/strict";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";

test("Performance Brain serves an owned evidence-only Studio surface",async()=>{
  const handle=createStudioHttpHandler();
  const page=await handle({method:"GET",pathname:"/performance-brain"});
  assert.equal(page.status,200);
  assert.match(page.headers["content-type"],/text\/html/);
  assert.match(page.body,/Performance Brain/);
  assert.match(page.body,/Evidence Grade/);
  assert.match(page.body,/Outcome Loop/);
  assert.match(page.body,/No auto-publish/i);
  assert.match(page.body,/No auto-spend/i);
});
