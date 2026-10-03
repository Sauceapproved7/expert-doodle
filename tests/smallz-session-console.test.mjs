import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("Smallz console uses current Supabase session for browser requests",async()=>{
 const html=await readFile(new URL("../hercules-bot/index.html",import.meta.url),"utf8");
 assert.match(html,/auth\.getSession\(\)/);
 assert.match(html,/authorization['"]?:['"]?['"]?Bearer /i);
 assert.match(html,/\/api\/browser/);
 assert.doesNotMatch(html,/localStorage\.setItem\([^)]*(token|session)/i);
});
test("Smallz is the user-facing bot name",async()=>{
 const html=await readFile(new URL("../hercules-bot/index.html",import.meta.url),"utf8");
 assert.match(html,/<title>Smallz<\/title>/);
 assert.match(html,/>SMALLZ</);
 assert.doesNotMatch(html,/>HERCULES BOT</);
});
