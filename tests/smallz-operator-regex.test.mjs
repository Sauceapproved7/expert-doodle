import test from "node:test";
import assert from "node:assert/strict";
import {createOperatorConsole} from "../hercules-bot/operator-v4.mjs";

test("Smallz operator parses bounded browser commands",async()=>{
 const calls=[]; const c=createOperatorConsole({controller:{run:async(x)=>{calls.push(x);return x;}}});
 const a=await c.plan("open browser https://example.com");
 assert.equal(a.status,"planned");assert.equal(a.command.verb,"browser-navigate");assert.equal(a.command.payload.target,"https://example.com");assert.equal(a.requiresApproval,true);
 const b=await c.plan("inspect browser https://example.com/path");
 assert.equal(b.command.verb,"browser-scrape");
});
