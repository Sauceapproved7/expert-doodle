import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source=readFileSync(new URL('../validation-kit.js',import.meta.url),'utf8');
function getKit(){
  const window={};runInNewContext(source,{window});
  return window.GlowValidationKit;
}
test('inclusive test matrix spans deep complexions, face and nail modes',()=>{
  const kit=getKit();
  assert.equal(kit.scenarios.length,6);
  assert.ok(kit.scenarios.some(s=>s.label.includes('Deep/rich complexion')&&s.mode==='face'));
  assert.ok(kit.scenarios.some(s=>s.label.includes('Deeper skin tone')&&s.mode==='hand'));
  assert.ok(kit.scenarios.some(s=>s.label.includes('mixed lighting')));
  assert.equal(kit.scenarios.filter(s=>s.mode==='face').length,4);
  assert.equal(kit.scenarios.filter(s=>s.mode==='hand').length,2);
});
test('no checklist item claims a physical device test by default',()=>{
  const kit=getKit().create(),before=kit.snapshot();
  assert.equal(before.status,'self-reported-unverified');
  assert.equal(before.accuracyCertified,false);
  assert.ok(before.scenarios.every(s=>s.result==='not-tested'));
  assert.equal(JSON.stringify(before).includes('deviceId'),false);
  assert.equal(JSON.stringify(before).includes('image'),false);
});
test('only known scenarios and fixed outcomes may be recorded, never free text',()=>{
  const kit=getKit().create();
  assert.equal(kit.setResult('face-deep-daylight','looks-aligned'),true);
  assert.equal(kit.setResult('hand-motion','needs-review'),true);
  assert.equal(kit.setResult('none','looks-aligned'),false);
  assert.equal(kit.setResult('face-deep-daylight','I am Person X'),false);
  const snapshot=kit.snapshot();
  assert.equal(snapshot.scenarios.find(s=>s.id==='face-deep-daylight').result,'looks-aligned');
  assert.equal(snapshot.scenarios.find(s=>s.id==='hand-motion').result,'needs-review');
  assert.equal(snapshot.accuracyCertified,false);
});
test('checklist can be reset without storing results',()=>{
  const kit=getKit().create();
  kit.setResult('face-motion','needs-review');
  const previous=kit.snapshot();
  kit.clear();
  assert.equal(previous.scenarios.find(s=>s.id==='face-motion').result,'needs-review');
  assert.equal(kit.snapshot().scenarios.find(s=>s.id==='face-motion').result,'not-tested');
  assert.equal(kit.snapshot().accuracyCertified,false);
});
