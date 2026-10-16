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

test('preview computes only actual proposed checklist differences and never mutates review',()=>{
  const current=kit(),original=JSON.stringify(current.snapshot());
  const validation=restore.validate(example(),current.snapshot());
  const diff=restore.preview(validation,current.snapshot());
  assert.equal(diff.error,null);
  assert.equal(diff.total,10);
  assert.equal(diff.unchanged,8);
  assert.equal(diff.differences.length,2);
  assert.equal(diff.differences[0].before,'not_provided');
  assert.equal(diff.differences[0].after,'claimed_unverified');
  assert.equal(diff.differences[1].after,'needs_review');
  assert.equal(Object.isFrozen(diff),true);
  assert.equal(Object.isFrozen(diff.differences),true);
  assert.equal(Object.isFrozen(diff.differences[0]),true);
  assert.equal(JSON.stringify(current.snapshot()),original,'preview must not modify choices');
  assert.ok(diff.differences.every(x=>!Object.keys(x).some(k=>['verified','approved','published','url','identity'].includes(k))));
});
test('preview has zero changes for identical packet and fails closed for incomplete changes',()=>{
  const state=kit();
  assert.equal(restore.preview(restore.validate(copy(state.snapshot()),state.snapshot()),state.snapshot()).differences.length,0);
  const initial=restore.validate(example(),state.snapshot());
  const partial={...initial,changes:initial.changes.slice(0,2)};
  assert.ok(restore.preview(partial,state.snapshot()).error);
  const duplicated={...initial,changes:[...initial.changes.slice(0,-1),initial.changes[0]]};
  assert.ok(restore.preview(duplicated,state.snapshot()).error);
  assert.ok(restore.preview({error:'invalid',changes:[]},state.snapshot()).error);
});
test('atomic batch application validates full batch before writing any supplier choices',()=>{
  const state=kit();
  const changes=restore.validate(example(),state.snapshot()).changes;
  const before=JSON.stringify(state.snapshot());
  assert.equal(state.apply(changes.slice(0,-1)),false);
  assert.equal(JSON.stringify(state.snapshot()),before,'incomplete batch may not modify any choice');
  const withFake=changes.map(x=>({...x}));
  withFake[8].status='verified';
  assert.equal(state.apply(withFake),false);
  assert.equal(JSON.stringify(state.snapshot()),before,'unsupported approvals cannot partially modify a review');
  const duplicate=changes.map(x=>({...x}));
  duplicate[9]=duplicate[8];
  assert.equal(state.apply(duplicate),false);
  assert.equal(JSON.stringify(state.snapshot()),before,'duplicate requirements cannot partially modify choices');
  assert.equal(state.apply(changes),true);
  assert.equal(state.snapshot().records[0].requirements.resale_rights,'claimed_unverified');
  assert.equal(state.snapshot().records[1].requirements.media_rights,'needs_review');
  assert.equal(state.snapshot().approved,0);
  assert.equal(state.snapshot().published,0);
  assert.equal(state.snapshot().ownerApproval,'not_granted');
});
