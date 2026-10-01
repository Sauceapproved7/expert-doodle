import test from "node:test";
import assert from "node:assert/strict";
import {createMarketing16DeployBridge} from "../hercules-deploy/marketing-16-bridge.mjs";
import {createMarketingKillSwitch} from "../sauceapproved-studio/marketing-16/provider-live-boundary.mjs";

const providerAuthorization={schema:"sauceapproved.marketing-16.provider-publish-authorization",status:"provider_publish_authorized",publishRequestAuthorized:true,authorizationId:"deploy-pub-1",brandId:"SauceApproved",provider:"metricool",accountId:"acct-1",creativeId:"creative-1",destinationUrl:"https://sauceapproved.com/",networkCalled:false,providerMutationPerformed:false,spendAllowed:false,automaticMutation:false};

test("marketing 16 deploy bridge exposes the merged runtime through a read-only deployer boundary",()=>{
  const bridge=createMarketing16DeployBridge();
  const health=bridge.health();
  assert.equal(health.ok,true);
  assert.equal(health.service,"hercules-marketing-16");
  assert.equal(health.modules,16);
  assert.equal(health.deployerConnected,true);
  assert.equal(health.autoPublish,false);
  assert.equal(health.autoSpend,false);
  assert.equal(health.storefrontMutation,false);
});

test("marketing 16 deploy bridge plans all 16 modules without releasing mutations",()=>{
  const bridge=createMarketing16DeployBridge();
  const plan=bridge.plan({brandId:"sauceapproved",objective:"grow verified revenue",evidenceIds:["proof-1"]});
  assert.equal(plan.actions.length,16);
  assert.equal(plan.releaseReady,false);
  assert.ok(plan.actions.every(action=>action.requiresExplicitReleaseAuthorization));
});

test("marketing 16 deploy bridge rejects mutation-shaped operations",()=>{
  const bridge=createMarketing16DeployBridge();
  assert.throws(()=>bridge.execute("publish",{}),/marketing_operation_not_allowed/);
});

test("marketing 16 deploy bridge fails closed for provider execution unless a connector is explicitly injected",async()=>{
  const bridge=createMarketing16DeployBridge();
  await assert.rejects(()=>bridge.execute("provider_publish_execute",{authorization:providerAuthorization}),/provider_connector_not_configured/);
});

test("marketing 16 deploy bridge propagates an injected provider connector and kill switch",async()=>{
  let calls=0;
  const killSwitch=createMarketingKillSwitch();
  const bridge=createMarketing16DeployBridge({providerConnectors:{metricool:async()=>{calls++;return {externalId:"deploy-post-1"};}},killSwitch});
  const receipt=await bridge.execute("provider_publish_execute",{authorization:providerAuthorization});
  assert.equal(calls,1);
  assert.equal(receipt.status,"provider_publish_executed");
  assert.equal(receipt.externalId,"deploy-post-1");
  assert.equal(receipt.spendAllowed,false);
});
