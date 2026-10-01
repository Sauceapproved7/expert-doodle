import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketingRuntimeConfig} from '../sauceapproved-studio/marketing-16/runtime-config.mjs';

test('runtime config defaults to no provider connectors and no elevated authority',()=>{
 const config=createMarketingRuntimeConfig();
 assert.deepEqual(config.providerConnectors,{});
 assert.equal(config.spendAllowed,false);
 assert.equal(config.automaticPublishing,false);
});

test('runtime config accepts connector map and kill switch without elevating authority',()=>{
 const publish=async()=>({externalId:'post-1'});
 const killSwitch={state:()=>({active:false,reason:''})};
 const config=createMarketingRuntimeConfig({providerConnectors:{metricool:publish},killSwitch});
 assert.equal(config.providerConnectors.metricool,publish);
 assert.equal(config.killSwitch,killSwitch);
 assert.equal(config.spendAllowed,false);
 assert.equal(config.automaticPublishing,false);
});

test('runtime config rejects requests to elevate spend or automatic publishing',()=>{
 assert.throws(()=>createMarketingRuntimeConfig({spendAllowed:true}),/marketing_runtime_authority_elevation_forbidden/);
 assert.throws(()=>createMarketingRuntimeConfig({automaticPublishing:true}),/marketing_runtime_authority_elevation_forbidden/);
});
