import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderConnector, executeAuthorizedPublish, createMarketingKillSwitch} from '../sauceapproved-studio/marketing-16/provider-live-boundary.mjs';

const auth={schema:'sauceapproved.marketing-16.provider-publish-authorization',status:'provider_publish_authorized',publishRequestAuthorized:true,authorizationId:'pub-1',brandId:'SauceApproved',provider:'metricool',accountId:'acct-1',creativeId:'creative-1',networkCalled:false,providerMutationPerformed:false,spendAllowed:false,automaticMutation:false};

test('connector requires an explicit publish implementation',()=>{assert.throws(()=>createProviderConnector({provider:'metricool'}),/provider_publish_handler_required/);});
test('authorized publish delegates once and grants no spend authority',async()=>{let calls=0;const connector=createProviderConnector({provider:'metricool',publish:async()=>{calls++;return {externalId:'post-1'};}});const kill=createMarketingKillSwitch();const r=await executeAuthorizedPublish(auth,connector,kill);assert.equal(calls,1);assert.equal(r.status,'provider_publish_executed');assert.equal(r.externalId,'post-1');assert.equal(r.spendAllowed,false);});
test('kill switch blocks provider execution',async()=>{let calls=0;const connector=createProviderConnector({provider:'metricool',publish:async()=>{calls++;return {externalId:'post-1'};}});const kill=createMarketingKillSwitch();kill.activate('owner_stop');await assert.rejects(()=>executeAuthorizedPublish(auth,connector,kill),/marketing_kill_switch_active/);assert.equal(calls,0);});
test('publish authorization cannot carry spend authority',async()=>{const connector=createProviderConnector({provider:'metricool',publish:async()=>({externalId:'post-1'})});const kill=createMarketingKillSwitch();await assert.rejects(()=>executeAuthorizedPublish({...auth,spendAllowed:true},connector,kill),/provider_publish_authorization_invalid/);});
