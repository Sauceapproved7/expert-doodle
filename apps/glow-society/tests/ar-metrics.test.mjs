import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script=readFileSync(new URL('../ar-metrics.js',import.meta.url),'utf8');
function create(mode='face') {
  const window={};runInNewContext(script,{window});
  assert.equal(Object.isFrozen(window.GlowArMetrics),true);
  return window.GlowArMetrics.createSession(mode);
}
test('AR session starts without fake success or recording coordinates',()=>{
  const meter=create('face'),empty=meter.snapshot();
  assert.equal(empty.samples,0);
  assert.equal(empty.detectionPercent,null);
  assert.equal(empty.meanInferenceMs,null);
  assert.equal(empty.sampleRateHz,null);
  assert.equal(empty.validity,'insufficient-samples');
  assert.equal(empty.accuracyCertified,false);
  assert.equal(Object.prototype.hasOwnProperty.call(empty,'images'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(empty,'deviceId'),false);
});
test('only valid timestamp-ordered samples are counted',()=>{
  const meter=create('hand');
  assert.equal(meter.record(5,true,1000),true);
  assert.equal(meter.record(3,false,1200),true);
  assert.equal(meter.record(5,true,1100),false);
  assert.equal(meter.record(NaN,true,1300),false);
  assert.equal(meter.record(-4,true,1400),false);
  const snapshot=meter.snapshot();
  assert.equal(snapshot.samples,2);
  assert.equal(snapshot.detectedSamples,1);
  assert.equal(snapshot.detectionPercent,50);
  assert.equal(snapshot.meanInferenceMs,4);
  assert.equal(snapshot.sampleRateHz,5);
  assert.equal(snapshot.accuracyCertified,false);
});
test('30 samples produce observational status, never calibration certification',()=>{
  const meter=create('face');
  for(let i=0;i<30;i++)assert.equal(meter.record(5+i%2,i<24,1000+i*80),true);
  const s=meter.snapshot();
  assert.equal(s.samples,30);
  assert.equal(s.detectedSamples,24);
  assert.equal(s.detectionPercent,80);
  assert.equal(s.validity,'observational-only');
  assert.equal(s.accuracyCertified,false);
  assert.ok(s.sampleRateHz>12&&s.sampleRateHz<13);
});
test('invalid modes are refused and aggregate values are read-only',()=>{
  assert.throws(()=>create('other'),/Invalid AR mode/);
  const report=create().snapshot();
  assert.equal(Object.isFrozen(report),true);
  assert.equal(Object.keys(report).sort().join(','),'accuracyCertified,detectedSamples,detectionPercent,meanInferenceMs,mode,sampleRateHz,samples,schema,validity');
});
