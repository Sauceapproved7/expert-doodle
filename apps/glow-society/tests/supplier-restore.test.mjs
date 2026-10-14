import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {TextEncoder} from 'node:util';

const window={};
const context={window,TextEncoder};
runInNewContext(readFileSync(new URL('../supplier-review.js',import.meta.url),'utf8'),context);
runInNewContext(readFileSync(new URL('../supplier-restore.js',import.meta.url),'utf8'),context);
const reviewer=window.GlowSupplierReview,restore=window.GlowSupplierRestore;
const candidates=[
  {sku:'DEMO-01',brand:'Fictional Brand',name:'Example Coil Style',provenance:'unverified',publication:'blocked'},
  {sku:'DEMO-02',brand:'Fictional Brand',name:'Example Lip Look',provenance:'unverified',publication:'blocked'}
];
const kit=()=>reviewer.create(candidates);
const copy=obj=>JSON.parse(JSON.stringify(obj));
const example=()=>{
  const state=kit();
  state.set('DEMO-01','resale_rights','claimed_unverified');
  state.set('DEMO-02','media_rights','needs_review');
  return copy(state.snapshot());
};

test('exact matching unverified packet produces a complete, bounded restoration plan',()=>{
  const state=kit(),baseline=state.snapshot(),packet=example();
  const result=restore.parse(JSON.stringify(packet),baseline);
  assert.equal(result.error,null);
  assert.equal(result.changes.length,10);
  assert.equal(result.changes.find(x=>x.sku==='DEMO-01'&&x.requirement==='resale_rights').status,'claimed_unverified');
  assert.equal(result.changes.find(x=>x.sku==='DEMO-02'&&x.requirement==='media_rights').status,'needs_review');
  assert.equal(state.snapshot().records[0].requirements.resale_rights,'not_provided','validator must not mutate a review');
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.changes),true);
});
test('unexpected fields, approvals, verified claims and sale states fail closed',()=>{
  const baseline=kit().snapshot();
  for(const change of [
    p=>{p.approved=1;},p=>{p.published=1;},p=>{p.ownerApproval='granted';},
    p=>{p.independentVerification='performed';},p=>{p.releaseEligible=true;},
    p=>{p.authToken='fake';},p=>{p.records[0].approved=true;},
    p=>{p.records[0].requirements.resale_rights='verified';},
    p=>{p.records[0].requirements.admin=true;},
    p=>{delete p.records[0].requirements.feed_freshness;},
    p=>{p.records[0].verdict='ready_to_sell';},
    p=>{p.scope='offline-unverified-action-plan';},
  ]){
    const packet=example();change(packet);
    const result=restore.validate(packet,baseline);
    assert.ok(result.error,JSON.stringify(packet).slice(0,140));
    assert.equal(result.changes.length,0);
  }
});
test('cannot apply a packet to changed/missing/duplicated or reordered identity fields',()=>{
  const baseline=kit().snapshot();
  const changes=[
    p=>{p.records[0].sku='DIFFERENT-01';},
    p=>{p.records[0].name='Another Example';},
    p=>{p.records[0].brand='Different Supplier';},
    p=>{p.records[1].sku='DEMO-01';},
    p=>{p.records.pop();},
    p=>{p.records.push(copy(p.records[0]));},
  ];
  for(const change of changes){
    const packet=example();change(packet);
    assert.ok(restore.validate(packet,baseline).error);
  }
  const reordered=example();reordered.records.reverse();
  assert.equal(restore.validate(reordered,baseline).error,null,'same candidates in a different order must be allowed');
});
test('rejects wrong, absent or empty baseline and file-size/JSON failures',()=>{
  assert.ok(restore.validate(example(),null).error);
  assert.ok(restore.validate(example(),reviewer.create([]).snapshot()).error);
  assert.ok(restore.parse('{invalid',kit().snapshot()).error);
  assert.ok(restore.parse('a'.repeat(65537),kit().snapshot()).error);
  assert.ok(restore.parse(null,kit().snapshot()).error);
  assert.ok(restore.parse(JSON.stringify({schemaVersion:1}),kit().snapshot()).error);
});
test('only intended text statuses are carried: no URLs, files, contacts, proof or identity credentials',()=>{
  const result=restore.validate(example(),kit().snapshot());
  assert.equal(result.error,null);
  for(const change of result.changes){
    assert.deepEqual(Object.keys(change).sort(),['requirement','sku','status']);
    assert.ok(['not_provided','claimed_unverified','needs_review'].includes(change.status));
    assert.equal(Object.isFrozen(change),true);
  }
});
