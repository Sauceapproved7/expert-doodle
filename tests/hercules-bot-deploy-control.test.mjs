import test from "node:test";
import assert from "node:assert/strict";
import {createDeployControl} from "../hercules-bot/deploy-control.mjs";

test("deploy control submits a release to Hercules Deploy",async()=>{
 let call=null;
 const deploy=createDeployControl({request:async req=>{call=req;return {deploymentId:"dep-1",status:"queued"}}});
 const result=await deploy.release({releaseId:"rel-1",sourceCommit:"abc",artifactFingerprint:"sha256:123",target:{kind:"hercules_bot_local",reference:"bot"},publicOrigin:"https://example.com"});
 assert.equal(result.deploymentId,"dep-1");
 assert.equal(call.method,"POST");
 assert.equal(call.path,"/v1/deployments");
 assert.equal(call.body.releaseId,"rel-1");
});

test("deploy control status is read-only",async()=>{
 let call=null;
 const deploy=createDeployControl({request:async req=>{call=req;return {status:"verified"}}});
 const result=await deploy.status("dep-1");
 assert.equal(result.status,"verified");
 assert.equal(call.method,"GET");
 assert.equal(call.path,"/v1/deployments/dep-1");
});

test("deploy control rejects malformed identifiers",async()=>{
 const deploy=createDeployControl({request:async()=>({})});
 await assert.rejects(deploy.status("../secret"),/invalid deployment id/);
});

test("deploy control never accepts deployer credentials in release input",async()=>{
 const deploy=createDeployControl({request:async req=>{assert.equal("token" in req.body,false);return {deploymentId:"dep-2"}}});
 await deploy.release({releaseId:"rel-2",sourceCommit:"def",artifactFingerprint:"sha256:456",target:{kind:"hercules_bot_local",reference:"bot"},token:"bad"});
});
