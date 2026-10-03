import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketing16Runtime} from '../sauceapproved-studio/marketing-16/runtime.mjs';
import {createMarketingKillSwitch} from '../sauceapproved-studio/marketing-16/provider-live-boundary.mjs';

const authorization={schema:'sauceapproved.marketing-16.provider-publish-authorization',status:'provider_publish_authorized',publishRequestAuthorized:true,authorizationId:'pub-runtime-1',brandId:'SauceApproved',provider:'metricool',accountId:'acct-1',creativeId:'creative-1',destinationUrl:'https://sauceapproved.com/',networkCalled:false,providerMutationPerformed:false,spendAllowed:false,automaticMutation:false};

test('runtime executes an authorized provider publish through the injected connector boundary',async()=>{
  let calls=0;
  const killSwitch=createMarketingKillSwitch();
  const runtime=createMarketing16Runtime({providerConnectors:{metricool:async()=>{calls++;return {externalId:'metricool-post-1'};}},killSwitch});
  const receipt=await runtime.execute('provider_publish_execute',{authorization});
  assert.equal(calls,1);
  assert.equal(receipt.status,'provider_publish_executed');
  assert.equal(receipt.externalId,'metricool-post-1');
  assert.equal(receipt.providerMutationPerformed,true);
  assert.equal(receipt.spendAllowed,false);
});

test('runtime provider publish remains fail-closed when no connector is injected',async()=>{
  const runtime=createMarketing16Runtime();
  await assert.rejects(()=>runtime.execute('provider_publish_execute',{authorization}),/provider_connector_not_configured/);
});

test('runtime kill switch blocks provider execution before the connector is called',async()=>{
  let calls=0;
  const killSwitch=createMarketingKillSwitch();
  killSwitch.activate('owner_stop');
  const runtime=createMarketing16Runtime({providerConnectors:{metricool:async()=>{calls++;return {externalId:'should-not-run'};}},killSwitch});
  await assert.rejects(()=>runtime.execute('provider_publish_execute',{authorization}),/marketing_kill_switch_active/);
  assert.equal(calls,0);
});
