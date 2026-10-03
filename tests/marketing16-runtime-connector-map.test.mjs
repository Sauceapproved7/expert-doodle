import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeConnectorMap} from '../sauceapproved-studio/marketing-16/runtime-connector-map.mjs';

test('runtime connector map is empty by default',()=>{
  assert.deepEqual(createRuntimeConnectorMap(),{});
});

test('runtime connector map exposes only controlled adapter publish handlers',async()=>{
  const adapter=Object.freeze({provider:'metricool',credentialsEmbedded:false,spendAllowed:false,automaticMutation:false,publish:async()=>({externalId:'post-1'})});
  const map=createRuntimeConnectorMap([adapter]);
  assert.equal(typeof map.metricool,'function');
  assert.equal((await map.metricool({})).externalId,'post-1');
});

test('runtime connector map rejects unsafe adapters and duplicates',()=>{
  assert.throws(()=>createRuntimeConnectorMap([{provider:'metricool',credentialsEmbedded:false,spendAllowed:true,automaticMutation:false,publish:async()=>({})}]),/provider_adapter_not_controlled/);
  const safe={provider:'metricool',credentialsEmbedded:false,spendAllowed:false,automaticMutation:false,publish:async()=>({})};
  assert.throws(()=>createRuntimeConnectorMap([safe,safe]),/provider_already_registered/);
});
