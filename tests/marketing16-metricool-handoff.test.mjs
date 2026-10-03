import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetricoolHandoff} from '../sauceapproved-studio/marketing-16/metricool-handoff.mjs';

test('creates approval-ready manual-delivery handoff',()=>{
 const h=createMetricoolHandoff({brandId:'6894246',authorizationId:'auth-1',creativeId:'creative-1',text:'hello',network:'linkedin'});
 assert.equal(h.status,'approval_ready');
 assert.equal(h.provider,'metricool');
 assert.equal(h.autoPublish,false);
 assert.equal(h.spendAllowed,false);
 assert.equal(h.mutationPerformed,false);
 assert.equal(h.credentialRef,'connector://metricool');
});

test('rejects missing authorization and unsupported authority',()=>{
 assert.throws(()=>createMetricoolHandoff({brandId:'6894246'}),/authorization_id_required/);
 assert.throws(()=>createMetricoolHandoff({brandId:'6894246',authorizationId:'a',autoPublish:true}),/metricool_handoff_authority_elevation_forbidden/);
 assert.throws(()=>createMetricoolHandoff({brandId:'6894246',authorizationId:'a',spendAllowed:true}),/metricool_handoff_authority_elevation_forbidden/);
});
