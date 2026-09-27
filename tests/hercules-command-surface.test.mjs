import test from "node:test";
import assert from "node:assert/strict";
import {createCommandRequest,routeCommand,verifyCommandRequest} from "../hercules-runtime/command-surface.mjs";

test("same normalized command is deterministic",()=>{const input={intentId:"job-1",capability:"recovery.assess",payload:{invoiceId:"inv-1"}};const a=createCommandRequest(input),b=createCommandRequest({...input,payload:{invoiceId:"inv-1"}});assert.equal(a.commandSha256,b.commandSha256);assert.equal(verifyCommandRequest(a).valid,true)});
test("owned capability routes without provider details",()=>{const c=createCommandRequest({intentId:"job-1",capability:"forge.build",payload:{prompt:"build app"}});const r=routeCommand(c);assert.equal(r.route,"hercules-forge");assert.equal(r.executionAuthority,false);assert.equal("provider" in r,false)});
test("unknown capability fails closed",()=>{assert.throws(()=>createCommandRequest({intentId:"job-1",capability:"unknown.run",payload:{}}),/unsupported capability/i)});
test("provider-specific capability names are rejected",()=>{assert.throws(()=>createCommandRequest({intentId:"job-1",capability:"supabase.deploy",payload:{}}),/unsupported capability/i)});
test("tampering is detected",()=>{const c=createCommandRequest({intentId:"job-1",capability:"chat.run",payload:{text:"hello"}});c.payload.text="changed";assert.equal(verifyCommandRequest(c).valid,false)});
