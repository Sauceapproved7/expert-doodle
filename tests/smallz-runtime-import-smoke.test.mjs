import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("Smallz runtime imports cleanly with transitive modules",async()=>{
 const mod=await import("../hercules-bot/app-server.mjs");
 assert.equal(typeof mod.createHerculesBotApp,"function");
});

test("Smallz app server contains no literal escaped-newline source corruption",async()=>{
 const src=await readFile(new URL("../hercules-bot/app-server.mjs",import.meta.url),"utf8");
 assert.equal(src.includes(";\\\\nimport"),false);
 assert.equal(src.includes("}\\\\n"),false);
});
