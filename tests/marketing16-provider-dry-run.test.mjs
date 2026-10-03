import test from 'node:test';
import assert from 'node:assert/strict';
import {dryRunProviderCampaign} from '../sauceapproved-studio/marketing-16/provider-dry-run.mjs';

const prepared={schema:'sauceapproved.marketing-16.controlled-execution',status:'campaign_prepared',authorized:true,operation:'prepare_campaign',authorizationId:'auth-1',brandId:'SauceApproved',recommendation:'short_video',evidenceIds:['ev-1'],publishAllowed:false,spendAllowed:false,automaticMutation:false};
const payload={provider:'metricool',accountId:'acct-1',creativeId:'creative-1',destinationUrl:'https://sauceapproved.com/',budget:{currency:'USD',amount:25}};

test('validates a prepared campaign into a non-executing provider receipt',()=>{const r=dryRunProviderCampaign(prepared,payload);assert.equal(r.status,'provider_dry_run_valid');assert.equal(r.provider,'metricool');assert.equal(r.networkCalled,false);assert.equal(r.publishAllowed,false);assert.equal(r.spendAllowed,false);assert.equal(r.executionAuthorized,false);});
test('rejects incomplete provider payloads',()=>{assert.throws(()=>dryRunProviderCampaign(prepared,{...payload,creativeId:''}),/provider_payload_invalid/);});
test('rejects non-prepared campaign artifacts',()=>{assert.throws(()=>dryRunProviderCampaign({...prepared,status:'other'},payload),/prepared_campaign_required/);});
