import assert from 'node:assert/strict';
import test from 'node:test';
import {assessCapture} from '../sauceapproved-studio/vintage-camera/capture-quality.mjs';

test('rejects sparse or too-short capture instead of labeling export complete',()=>{
  assert.deepEqual(assessCapture({frames:5,elapsedMs:3000}),{ok:false,fps:1.7,reason:'low_frame_cadence'});
  assert.equal(assessCapture({frames:0,elapsedMs:3000}).reason,'no_rendered_frames');
  assert.equal(assessCapture({frames:10,elapsedMs:300}).reason,'capture_too_short');
});

test('accepts a sustained render cadence and bounds invalid measurements',()=>{
  assert.deepEqual(assessCapture({frames:75,elapsedMs:5000}),{ok:true,fps:15,reason:null});
  assert.equal(assessCapture({frames:NaN,elapsedMs:-1}).reason,'invalid_capture_metrics');
});

test('rejects a capture interrupted by tab visibility even at an otherwise good cadence',()=>{
  assert.deepEqual(assessCapture({frames:75,elapsedMs:5000,interrupted:true}),
    {ok:false,fps:15,reason:'capture_interrupted'});
});
