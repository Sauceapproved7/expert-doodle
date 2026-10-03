import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetricoolPublishAdapter} from '../sauceapproved-studio/marketing-16/metricool-publish-adapter.mjs';

test('adapter is controlled and publish-only',()=>{
 const adapter=createMetricoolPublishAdapter({brandId:'6894246',publish:async()=>({id:'p1'})});
 assert.equal(adapter.provider,'metricool');
 assert.equal(adapter.credentialsEmbedded,false);
 assert.equal(adapter.spendAllowed,false);
 assert.equal(adapter.automaticMutation,false);
 assert.equal(adapter.credentialRef,'connector://metricool');
});

test('adapter forces no-spend and no-auto-publish into handler',async()=>{
 let seen;
 const adapter=createMetricoolPublishAdapter({brandId:'6894246',publish:async(input)=>(seen=input,{id:'p1'})});
 await adapter.publish({authorizationId:'auth-1',creativeId:'creative-1'});
 assert.equal(seen.brandId,'6894246');
 assert.equal(seen.spendAllowed,false);
 assert.equal(seen.autoPublish,false);
});

test('adapter rejects embedded credentials and authority elevation',()=>{
 assert.throws(()=>createMetricoolPublishAdapter({brandId:'6894246',token:'secret',publish:async()=>({})}),/embedded_provider_credentials_forbidden/);
 assert.throws(()=>createMetricoolPublishAdapter({brandId:'6894246',spendAllowed:true,publish:async()=>({})}),/metricool_publish_authority_elevation_forbidden/);
 assert.throws(()=>createMetricoolPublishAdapter({brandId:'6894246',automaticPublishing:true,publish:async()=>({})}),/metricool_publish_authority_elevation_forbidden/);
});
