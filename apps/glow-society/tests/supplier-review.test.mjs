import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../supplier-review.js',import.meta.url),'utf8');
function kit(){
 const window={};runInNewContext(src,{window});return window.GlowSupplierReview;
}
const row=(sku='SAMPLE-01')=>({sku,brand:'Example Brand',name:'Fictional Product',provenance:'unverified',publication:'blocked'});
test('supplier evidence packet fails closed even when all claims are marked supplied',()=>{
 const mod=kit(),review=mod.create([row()]);
 assert.equal(mod.REQUIREMENTS.length,5);
 for(const req of mod.REQUIREMENTS)assert.equal(review.set('sample-01',req.id,'claimed_unverified'),true);
 const packet=review.snapshot();
 assert.equal(packet.records.length,1);
 assert.ok(Object.values(packet.records[0].requirements).every(s=>s==='claimed_unverified'));
 assert.equal(packet.independentVerification,'not_performed');
 assert.equal(packet.ownerApproval,'not_granted');
 assert.equal(packet.approved,0);assert.equal(packet.published,0);
 assert.equal(packet.releaseEligible,false);
 assert.equal(packet.records[0].verdict,'unverified_not_for_sale');
});
test('unvalidated or approved looking records cannot enter supplier review',()=>{
 const mod=kit(),review=mod.create([
  row('SAMPLE-A'),
  {...row('SAMPLE-B'),publication:'approved'},
  {...row('SAMPLE-C'),provenance:'verified'},
  row('sample-a'),
 ]);
 const packet=review.snapshot();
 assert.equal(packet.records.length,1);
 assert.equal(packet.records[0].sku,'SAMPLE-A');
 assert.equal(review.set('SAMPLE-B','resale_rights','claimed_unverified'),false);
 assert.equal(review.set('SAMPLE-C','media_rights','claimed_unverified'),false);
});
test('unknown status, requirement and sku cannot grant or overwrite review',()=>{
 const mod=kit(),review=mod.create([row()]);
 assert.equal(review.set('SAMPLE-01','resale_rights','approved'),false);
 assert.equal(review.set('SAMPLE-01','approve_supplier','claimed_unverified'),false);
 assert.equal(review.set('UNLISTED','media_rights','claimed_unverified'),false);
 assert.equal(review.set('SAMPLE-01','resale_rights','needs_review'),true);
 assert.equal(review.snapshot().records[0].requirements.resale_rights,'needs_review');
 assert.equal(review.snapshot().releaseEligible,false);
});
test('reset returns all requirements to not supplied without mutating earlier packet',()=>{
 const review=kit().create([row()]);
 review.set('SAMPLE-01','resale_rights','claimed_unverified');
 const before=review.snapshot();
 review.reset();
 const after=review.snapshot();
 assert.equal(before.records[0].requirements.resale_rights,'claimed_unverified');
 assert.ok(Object.values(after.records[0].requirements).every(s=>s==='not_provided'));
 assert.equal(Object.isFrozen(after),true);
 assert.equal(Object.isFrozen(after.records[0]),true);
});
test('supplier review never invents a human verifier, uploaded document or granted sale authority',()=>{
 const report=kit().create([row()]).snapshot();
 const text=JSON.stringify(report);
 for(const key of ['identity','email','photo','evidenceFile','signature','approvedAt','paymentToken']){
   assert.ok(!Object.keys(report.records[0]).includes(key),key);
 }
 assert.doesNotMatch(text,/"ownerApproval":"granted"/);
 assert.doesNotMatch(text,/"published":[1-9]/);
 assert.equal(report.scope,'client-side-preparatory-review');
});
