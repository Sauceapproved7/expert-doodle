import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketing16Pipeline} from '../sauceapproved-studio/marketing-16/pipeline.mjs';

test('pipeline is fail-closed with no adapters',()=>{
 const pipeline=createMarketing16Pipeline();
 assert.equal(pipeline.spendAllowed,false);
 assert.equal(pipeline.automaticPublishing,false);
 assert.deepEqual(pipeline.providers,[]);
});

test('pipeline composes controlled adapters without elevating authority',()=>{
 const adapter=Object.freeze({provider:'metricool',credentialsEmbedded:false,spendAllowed:false,automaticMutation:false,publish:async()=>({externalId:'post-1'})});
 const killSwitch={state:()=>({active:false,reason:''})};
 const pipeline=createMarketing16Pipeline({adapters:[adapter],killSwitch});
 assert.deepEqual(pipeline.providers,['metricool']);
 assert.equal(typeof pipeline.runtimeConfig.providerConnectors.metricool,'function');
 assert.equal(pipeline.runtimeConfig.killSwitch,killSwitch);
 assert.equal(pipeline.spendAllowed,false);
 assert.equal(pipeline.automaticPublishing,false);
});

test('pipeline rejects authority elevation',()=>{
 assert.throws(()=>createMarketing16Pipeline({spendAllowed:true}),/marketing_pipeline_authority_elevation_forbidden/);
 assert.throws(()=>createMarketing16Pipeline({automaticPublishing:true}),/marketing_pipeline_authority_elevation_forbidden/);
});
