import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetricoolRuntimeWiring} from '../sauceapproved-studio/marketing-16/metricool-runtime-wiring.mjs';

test('wiring is inert until a publish handler is injected',()=>{
 const wiring=createMetricoolRuntimeWiring({brandId:'6894246'});
 assert.deepEqual(wiring.providers,[]);
 assert.deepEqual(wiring.providerConnectors,{});
 assert.equal(wiring.spendAllowed,false);
 assert.equal(wiring.automaticPublishing,false);
});

test('wiring registers Metricool only through controlled adapter',async()=>{
 let seen;
 const wiring=createMetricoolRuntimeWiring({brandId:'6894246',publish:async(input)=>(seen=input,{id:'p1'})});
 assert.deepEqual(wiring.providers,['metricool']);
 const result=await wiring.providerConnectors.metricool({authorizationId:'auth-1'});
 assert.equal(result.id,'p1');
 assert.equal(seen.brandId,'6894246');
 assert.equal(seen.spendAllowed,false);
 assert.equal(seen.autoPublish,false);
});

test('wiring rejects authority elevation',()=>{
 assert.throws(()=>createMetricoolRuntimeWiring({brandId:'6894246',spendAllowed:true}),/metricool_runtime_authority_elevation_forbidden/);
 assert.throws(()=>createMetricoolRuntimeWiring({brandId:'6894246',automaticPublishing:true}),/metricool_runtime_authority_elevation_forbidden/);
});
