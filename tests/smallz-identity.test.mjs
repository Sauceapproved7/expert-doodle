import test from "node:test";
import assert from "node:assert/strict";
import {createAbyssPolicy} from "../hercules-bot/abyss-policy.mjs";
test("Hercules bot identity is Smallz, never Evil Bot",()=>{
 const p=createAbyssPolicy();
 assert.equal(p.botName,"Smallz");
 assert.equal(p.name,"Smallz Abyss Stack");
 assert.equal(JSON.stringify(p).includes("Evil Bot"),false);
 assert.equal(p.capabilities.some(x=>x.id==="smallz-vs-smallz"),true);
 assert.equal(p.capabilities.some(x=>x.id==="evil-bot-vs-evil-bot"),false);
});
