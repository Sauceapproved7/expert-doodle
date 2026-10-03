import test from 'node:test';
import assert from 'node:assert/strict';
import {runMarketing16Simulation} from '../sauceapproved-studio/marketing-16/e2e-simulation.mjs';

const authorization=Object.freeze({
 schema:'sauceapproved.marketing-16.provider-publish-authorization',status:'provider_publish_authorized',
 publishRequestAuthorized:true,networkCalled:false,providerMutationPerformed:false,spendAllowed:false,automaticMutation:false,
 authorizationId:'auth-1',provider:'simulation',brandId:'brand-1',accountId:'acct-1',creativeId:'creative-1',destinationUrl:'https://example.invalid'
});

test('simulation proves authorized publish path without real network or spend',async()=>{
 const result=await runMarketing16Simulation({authorization});
 assert.equal(result.status,'simulation_publish_executed');
 assert.equal(result.provider,'simulation');
 assert.equal(result.externalId,'sim-auth-1');
 assert.equal(result.realNetworkCalled,false);
 assert.equal(result.realProviderMutationPerformed,false);
 assert.equal(result.spendAllowed,false);
 assert.equal(result.automaticPublishing,false);
});

test('simulation kill switch blocks execution before simulated provider call',async()=>{
 await assert.rejects(()=>runMarketing16Simulation({authorization,killSwitchActive:true}),/marketing_kill_switch_active/);
});
