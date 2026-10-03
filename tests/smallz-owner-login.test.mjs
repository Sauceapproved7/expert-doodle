import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("Smallz console establishes Supabase owner session and forwards bearer only in Authorization",async()=>{
 const html=await readFile(new URL("../hercules-bot/index.html",import.meta.url),"utf8");
 assert.match(html,/@supabase\/supabase-js@2/);
 assert.match(html,/auth\.getSession\(\)/);
 assert.match(html,/session\.access_token/);
 assert.match(html,/authorization[^\n]+Bearer/si);
 assert.doesNotMatch(html,/body\s*:\s*JSON\.stringify\([^)]*access_token/si);
 assert.match(html,/signInWithOtp/);
});


test("Smallz module keeps inline owner controls callable",async()=>{
 const html=await readFile(new URL("../hercules-bot/index.html",import.meta.url),"utf8");
 for(const name of ["post","send","signin"]) assert.match(html,new RegExp(`window\\.${name}\\s*=\\s*${name}`));
});
