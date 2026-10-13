import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {planApprovedPolicySync,POLICY_TYPES,publishApprovedPolicies} from '../shopify/hercules/backend/policy-sync.mjs';
const bodies=Object.fromEntries(POLICY_TYPES.map(t=>[t,'<p>'+t+' policy fully approved and ready</p>']));
const hashes=Object.fromEntries(POLICY_TYPES.map(t=>[t,crypto.createHash('sha256').update(bodies[t]).digest('hex')]));
const existing=POLICY_TYPES.map(t=>({type:t,body:'<p>old policy</p>'})).concat([{type:'PRIVACY_POLICY',body:'<p>existing detailed privacy</p>'}]);
const valid=()=>({shopDomain:'sauceapproved-3.myshopify.com',expectedShopDomain:'sauceapproved-3.myshopify.com',grantedScopes:['read_legal_policies','write_legal_policies'],existingPolicies:existing,approvedPolicies:bodies,approvalHashes:hashes,ownerApproved:true});

test('no native policy updates without legal-write permission',()=>assert.throws(()=>planApprovedPolicySync({...valid(),grantedScopes:['read_legal_policies']}),/missing_legal_write_scope/));
test('rejects missing owner approval',()=>assert.throws(()=>planApprovedPolicySync({...valid(),ownerApproved:false}),/owner_policy_approval_required/));
test('rejects different store and unapproved policy versions',()=>{
 assert.throws(()=>planApprovedPolicySync({...valid(),expectedShopDomain:'other.myshopify.com'}),/shop_domain_mismatch/);
 assert.throws(()=>planApprovedPolicySync({...valid(),approvedPolicies:{...bodies,SHIPPING_POLICY:'<p>Other approved policy full wording</p>'}}),/approval_hash_mismatch/);
});
test('rejects placeholders and non-allowlisted policy types',()=>{
 assert.throws(()=>planApprovedPolicySync({...valid(),approvedPolicies:{...bodies,SHIPPING_POLICY:'<p>Yes</p>'},approvalHashes:{...hashes,SHIPPING_POLICY:crypto.createHash('sha256').update('<p>Yes</p>').digest('hex')}}),/policy_placeholder/);
 assert.throws(()=>planApprovedPolicySync({...valid(),approvedPolicies:{...bodies,PRIVACY_POLICY:'<p>changed</p>'}}),/policy_type_not_allowed/);
});
test('plans exactly the four approved changes and preserves privacy',()=>{
 const p=planApprovedPolicySync(valid());assert.deepEqual(p.updates.map(x=>x.type),POLICY_TYPES);assert.equal(p.updates.length,4);
});
test('no-op when policy bodies match',()=>{
 const p=planApprovedPolicySync({...valid(),existingPolicies:POLICY_TYPES.map(t=>({type:t,body:bodies[t]}))});assert.equal(p.updates.length,0);
});
test('checks live scopes before writes and verifies post-write bodies',async()=>{
 const updates=[];const state=Object.fromEntries(existing.map(x=>[x.type,x.body]));
 const fetchImpl=async(_url,init)=>{
  const {query,variables}=JSON.parse(init.body);
  const payload=query.includes('mutation')?(()=>{
   const x=variables.shopPolicy;updates.push(x.type);state[x.type]=x.body;
   return {data:{shopPolicyUpdate:{shopPolicy:{type:x.type,body:x.body},userErrors:[]}}};
  })():({data:{shop:{myshopifyDomain:'sauceapproved-3.myshopify.com',shopPolicies:Object.entries(state).map(([type,body])=>({type,body}))},currentAppInstallation:{accessScopes:[{handle:'read_legal_policies'},{handle:'write_legal_policies'}]}}});
  return {ok:true,status:200,json:async()=>payload};
 };
 const result=await publishApprovedPolicies({shop:'sauceapproved-3.myshopify.com',expectedShopDomain:'sauceapproved-3.myshopify.com',apiVersion:'2026-10',accessToken:'fixture',approvedPolicies:bodies,approvalHashes:hashes,ownerApproved:true,fetchImpl});
 assert.deepEqual(updates,POLICY_TYPES);assert.equal(result.updated.length,4);
 assert.equal(state.PRIVACY_POLICY,'<p>existing detailed privacy</p>');
});
test('refuses all writes when live installation lacks the scope',async()=>{
 let calls=0;const fetchImpl=async(_url,init)=>{
  calls++;assert.doesNotMatch(JSON.parse(init.body).query,/mutation/);
  return {ok:true,status:200,json:async()=>({data:{shop:{myshopifyDomain:'sauceapproved-3.myshopify.com',shopPolicies:existing},currentAppInstallation:{accessScopes:[{handle:'read_legal_policies'}]}}})};
 };
 await assert.rejects(publishApprovedPolicies({shop:'sauceapproved-3.myshopify.com',expectedShopDomain:'sauceapproved-3.myshopify.com',apiVersion:'2026-10',accessToken:'fixture-token',approvedPolicies:bodies,approvalHashes:hashes,ownerApproved:true,fetchImpl}),/missing_legal_write_scope/);
 assert.equal(calls,1);
});
