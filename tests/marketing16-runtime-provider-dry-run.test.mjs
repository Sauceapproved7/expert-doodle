import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketing16Runtime} from '../sauceapproved-studio/marketing-16/runtime.mjs';

const prepared={schema:'sauceapproved.marketing-16.controlled-execution',status:'campaign_prepared',authorized:true,operation:'prepare_campaign',authorizationId:'auth-1',brandId:'SauceApproved',recommendation:'short_video',evidenceIds:['ev-1'],publishAllowed:false,spendAllowed:false,automaticMutation:false};
const provider={provider:'metricool',accountId:'acct-1',creativeId:'creative-1',destinationUrl:'https://sauceapproved.com/',budget:{currency:'USD',amount:25}};

test('runtime exposes provider dry-run validation without execution authority',()=>{
  const runtime=createMarketing16Runtime();
  const result=runtime.execute('provider_dry_run',{prepared,provider});
  assert.equal(result.status,'provider_dry_run_valid');
  assert.equal(result.networkCalled,false);
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.publishAllowed,false);
  assert.equal(result.spendAllowed,false);
});

test('runtime provider dry-run fails closed for incomplete payloads',()=>{
  const runtime=createMarketing16Runtime();
  assert.throws(()=>runtime.execute('provider_dry_run',{prepared,provider:{...provider,accountId:''}}),/provider_payload_invalid/);
});
