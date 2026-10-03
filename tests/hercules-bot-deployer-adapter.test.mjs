import test from "node:test";
import assert from "node:assert/strict";
import {createDeployerAdapter} from "../hercules-bot/deployer-adapter.mjs";

test("deployer adapter maps status command",async()=>{
 const adapter=createDeployerAdapter({request:async req=>({path:req.path,status:"verified"})});
 const out=await adapter["deploy-status"]({command:{payload:{deploymentId:"dep-1"}}});
 assert.equal(out.status,"verified");
 assert.match(out.path,/dep-1$/);
});

test("deployer adapter maps release command without command credentials",async()=>{
 let seen=null;
 const adapter=createDeployerAdapter({request:async req=>{seen=req;return {deploymentId:"dep-2"}}});
 await adapter["deploy-release"]({command:{payload:{releaseId:"rel-2",sourceCommit:"abc",artifactFingerprint:"sha256:123",target:{kind:"hercules_bot_local",reference:"bot"},token:"bad"}}});
 assert.equal(seen.body.token,undefined);
});
