import test from "node:test";
import assert from "node:assert/strict";
import {createHerculesBotApp} from "../hercules-bot/app-server.mjs";

test("bot app exposes health and owner state without requiring hardware", async()=>{
 const app=createHerculesBotApp({port:0});
 const health=await app.handle({method:"GET",url:"/health"});
 assert.equal(health.status,200);
 assert.equal(health.body.ok,true);
 const state=await app.handle({method:"GET",url:"/api/state"});
 assert.equal(state.status,200);
 assert.equal(state.body.body.emergencyStop,true);
 assert.equal(state.body.body.connected,false);
});

test("bot app plans a mutation before approval", async()=>{
 const app=createHerculesBotApp({port:0});
 const result=await app.handle({method:"POST",url:"/api/command",body:{text:"move body to stand"}});
 assert.equal(result.status,200);
 assert.equal(result.body.mode,"awaiting-approval");
 const state=await app.handle({method:"GET",url:"/api/state"});
 assert.equal(state.body.pending.command.target,"body");
});

test("bot app requires approval and then executes simulated body command", async()=>{
 const app=createHerculesBotApp({port:0});
 await app.handle({method:"POST",url:"/api/command",body:{text:"move body to stand"}});
 const approved=await app.handle({method:"POST",url:"/api/approve",body:{}});
 assert.equal(approved.status,200);
 assert.equal(approved.body.status,"completed");
 assert.equal(approved.body.receipts[0].evidence.simulated,true);
});

test("emergency stop clears pending command", async()=>{
 const app=createHerculesBotApp({port:0});
 await app.handle({method:"POST",url:"/api/command",body:{text:"move body to stand"}});
 const stopped=await app.handle({method:"POST",url:"/api/estop",body:{}});
 assert.equal(stopped.status,200);
 assert.equal(stopped.body.status,"stopped");
 const state=await app.handle({method:"GET",url:"/api/state"});
 assert.equal(state.body.pending,null);
});
