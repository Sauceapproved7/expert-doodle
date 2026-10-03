import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("Smallz app server is valid Render-ready source",async()=>{
 const src=await readFile(new URL("../hercules-bot/app-server.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(src,/\\\\n/);
 assert.match(src,/process\.env\.PORT/);
 assert.match(src,/server\.listen\(port,"0\.0\.0\.0"/);
 assert.match(src,/createSmallzOwnerBridge/);
 assert.match(src,/createSmallzRequestAuth/);
 assert.match(src,/url==="\/api\/browser"/);
 assert.doesNotMatch(src,/HERCULES_BROWSER_BRIDGE_TOKEN/);
});
