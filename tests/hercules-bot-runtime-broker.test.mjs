import test from "node:test";
import assert from "node:assert/strict";
import {authorizeBotRuntime,normalizeBotRuntimeCommand} from "../hercules-bot/runtime-broker-core.mjs";

test("runtime requires owner or admin membership",()=>{
 assert.equal(authorizeBotRuntime({role:"owner",status:"active"}),true);
 assert.equal(authorizeBotRuntime({role:"admin",status:"active"}),true);
 assert.equal(authorizeBotRuntime({role:"member",status:"active"}),false);
 assert.equal(authorizeBotRuntime({role:"owner",status:"disabled"}),false);
});

test("browser navigation stays bounded",()=>{
 assert.deepEqual(normalizeBotRuntimeCommand({action:"browser.navigate",url:"https://example.com"}),{action:"browser.navigate",url:"https://example.com/"});
 assert.throws(()=>normalizeBotRuntimeCommand({action:"browser.navigate",url:"file:///etc/passwd"}),/invalid browser url/);
});

test("deployer runtime exposes status only, not direct production publish",()=>{
 assert.deepEqual(normalizeBotRuntimeCommand({action:"deploy.status"}),{action:"deploy.status"});
 assert.throws(()=>normalizeBotRuntimeCommand({action:"deploy.publish",releaseClass:"production"}),/unsupported runtime action/);
});

test("credentials cannot be supplied in command payload",()=>{
 assert.throws(()=>normalizeBotRuntimeCommand({action:"browser.navigate",url:"https://example.com",token:"bad"}),/credential field rejected/);
});
