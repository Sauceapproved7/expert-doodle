import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const window={};runInNewContext(readFileSync(new URL('../supplier-actions.js',import.meta.url),'utf8'),{window});
const mod=window.GlowSupplierActions;
function packet(){
 return {schemaVersion:1,scope:'client-side-preparatory-review',independentVerification:'not_performed',ownerApproval:'not_granted',approved:0,published:0,releaseEligible:false,records:[
 {sku:'B-01',brand:'Example Brand',name:'Sample',verdict:'unverified_not_for_sale',requirements:{supplier_identity:'not_provided',resale_rights:'needs_review',media_rights:'claimed_unverified',product_compliance:'not_provided',feed_freshness:'not_provided'}}
 ]};
}
test('prioritizes disputed, then missing, then claimed without authority',()=>{
 const report=mod.prepare(packet());
 assert.equal(report.tasks.length,5);
 assert.equal(report.tasks[0].requirement,'resale_rights');
 assert.equal(report.tasks.at(-1).requirement,'media_rights');
 assert.equal(report.releaseEligible,false);
 assert.equal(report.approved,0);assert.equal(report.published,0);assert.equal(report.verified,0);
 assert.equal(report.tasks.every(x=>x.verified===false),true);
});
test('rejects forged approval, claimed verification and unknown status',()=>{
 for(const alteration of [{approved:1},{published:1},{ownerApproval:'granted'},{independentVerification:'performed'},{releaseEligible:true},{scope:'authorized'}]){
  assert.equal(mod.prepare({...packet(),...alteration}),null);
 }
 const p=packet();p.records[0].requirements.media_rights='verified';
 assert.equal(mod.prepare(p),null);
});
test('does not mutate source packet or attach product URLs or private documents',()=>{
 const p=packet(),snapshot=JSON.stringify(p),result=mod.prepare(p);
 assert.equal(JSON.stringify(p),snapshot);
 assert.equal(result.tasks.some(x=>Object.keys(x).includes('url')||Object.keys(x).includes('file')),false);
 assert.equal(Object.isFrozen(result),true);
 assert.equal(Object.isFrozen(result.tasks[0]),true);
});
