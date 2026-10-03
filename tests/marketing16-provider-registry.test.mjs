import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderRegistry} from '../sauceapproved-studio/marketing-16/provider-registry.mjs';

test('registry is empty and fail-closed by default',()=>{
  const registry=createProviderRegistry();
  assert.deepEqual(registry.providers(),[]);
  assert.throws(()=>registry.resolve('metricool'),/provider_not_registered/);
});

test('registry accepts only controlled adapters and resolves publish handlers',async()=>{
  const adapter=Object.freeze({provider:'metricool',credentialRef:'vault://metricool/main',credentialsEmbedded:false,spendAllowed:false,automaticMutation:false,publish:async()=>({externalId:'post-1'})});
  const registry=createProviderRegistry([adapter]);
  assert.deepEqual(registry.providers(),['metricool']);
  assert.equal((await registry.resolve('metricool')({})).externalId,'post-1');
});

test('registry rejects adapters with spend, automatic mutation, or embedded credentials',()=>{
  for(const adapter of [
    {provider:'metricool',credentialsEmbedded:true,spendAllowed:false,automaticMutation:false,publish:async()=>({})},
    {provider:'metricool',credentialsEmbedded:false,spendAllowed:true,automaticMutation:false,publish:async()=>({})},
    {provider:'metricool',credentialsEmbedded:false,spendAllowed:false,automaticMutation:true,publish:async()=>({})}
  ]) assert.throws(()=>createProviderRegistry([adapter]),/provider_adapter_not_controlled/);
});
