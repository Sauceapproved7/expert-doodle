import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {TextEncoder} from 'node:util';
import {URL} from 'node:url';

const source=readFileSync(new URL('../catalog-intake.js',import.meta.url),'utf8');
function getKit(){
  const window={};runInNewContext(source,{window,TextEncoder,URL});return window.GlowCatalogIntake;
}
const item=(patch={})=>({sku:'GLOW-SAMPLE-01',brand:'Sample Example Brand',name:'Example Not For Sale',category:'makeup',sourceUrl:'https://example.com/not-an-actual-product',tags:['deep','warm'],...patch});
const document=(items)=>({schemaVersion:1,products:items});
test('schema-valid supplier rows are quarantined, never verified or approved',()=>{
  const result=getKit().validate(document([item()]));
  assert.equal(result.error,null);
  assert.equal(result.items.length,1);
  assert.equal(result.rejected.length,0);
  assert.equal(result.approved,0);
  assert.equal(result.items[0].publication,'blocked');
  assert.equal(result.items[0].provenance,'unverified');
  assert.equal(result.items[0].name,'Example Not For Sale');
  assert.equal(Object.keys(result.items[0]).includes('price'),false);
});
test('invalid, malicious or private-origin source URLs are rejected before display',()=>{
  const urls=['javascript:alert(1)','http://example.com/thing','https://127.0.0.1/thing',
    'https://localhost/thing','https://test.local/thing','https://foo.internal/thing',
    'https://user:pass@example.com/product','https://example.com:8443/item','https://example.com/item#anchor','https://[::1]/thing'];
  const kit=getKit();
  for(const url of urls){
    const result=kit.validate(document([item({sourceUrl:url})]));
    assert.equal(result.items.length,0,url);
    assert.equal(result.rejected.length,1,url);
    assert.match(result.rejected[0].reason,/HTTPS source/);
  }
});
test('price, stock, fake approvals and HTML are not trusted or published',()=>{
  const kit=getKit();
  for(const patch of [
    {price:19.99},{inventory:10},{approved:true},{status:'verified'},{imageUrl:'https://example.com/x.png'},
    {name:'<script>alert(1)</script>'},{brand:'Example\nUnsafe'}
  ]){
    const result=kit.validate(document([item(patch)]));
    assert.equal(result.items.length,0,JSON.stringify(patch));
    assert.equal(result.rejected.length,1);
  }
});
test('duplicate SKUs are case-insensitive and unsafe tags are rejected',()=>{
  const kit=getKit();
  const duplicate=kit.validate(document([item(),item({sku:'glow-sample-01'})]));
  assert.equal(duplicate.items.length,1);
  assert.equal(duplicate.rejected.length,1);
  assert.match(duplicate.rejected[0].reason,/Duplicate SKU/);
  const bad=kit.validate(document([item({tags:['deep','deep']})]));
  assert.equal(bad.items.length,0);
  assert.equal(bad.rejected.length,1);
  assert.equal(kit.validate(document([item({tags:['skin-diagnosis']})])).items.length,0);
});
test('unrecognized schema, oversized feed and invalid JSON fail closed',()=>{
  const kit=getKit();
  assert.ok(kit.validate({products:[item()]}).error);
  assert.ok(kit.validate({schemaVersion:1,products:[item()],forcePublish:true}).error);
  assert.ok(kit.validate(document(Array.from({length:31},(_,i)=>item({sku:'item-'+i})))).error);
  assert.ok(kit.parse('{bad json').error);
  assert.ok(kit.parse('a'.repeat(65537)).error);
  assert.equal(kit.parse(JSON.stringify(kit.sample)).items.length,2);
});
test('the intake contract remains local, deterministic and does not mutate input',()=>{
  const feed=document([item({tags:['4c','coils'],category:'hair',sku:'STYLE-4C'}),item({sku:'NAIL-1',category:'nails',tags:[]})]);
  const original=JSON.stringify(feed),result=getKit().validate(feed);
  assert.equal(JSON.stringify(feed),original);
  assert.equal(result.items.length,2);
  assert.ok(result.items.every(row=>row.provenance==='unverified'&&row.publication==='blocked'));
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.items[0]),true);
  assert.equal(result.approved,0);
});
