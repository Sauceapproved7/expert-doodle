import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetricoolProviderProfile} from '../sauceapproved-studio/marketing-16/metricool-provider-profile.mjs';

test('Metricool profile records live read-only connectivity without credential material',()=>{
 const profile=createMetricoolProviderProfile({brandId:'6894246',brandLabel:'bigsauce99',timezone:'America/New_York',networks:['instagram','linkedin','tiktok']});
 assert.equal(profile.provider,'metricool');
 assert.equal(profile.connectivity,'live_read_only_verified');
 assert.equal(profile.credentialRef,'connector://metricool');
 assert.equal(profile.credentialsEmbedded,false);
 assert.equal(profile.spendAllowed,false);
 assert.equal(profile.automaticPublishing,false);
 assert.deepEqual(profile.networks,['instagram','linkedin','tiktok']);
});

test('Metricool profile rejects authority elevation',()=>{
 assert.throws(()=>createMetricoolProviderProfile({brandId:'6894246',spendAllowed:true}),/metricool_provider_authority_elevation_forbidden/);
 assert.throws(()=>createMetricoolProviderProfile({brandId:'6894246',automaticPublishing:true}),/metricool_provider_authority_elevation_forbidden/);
});
