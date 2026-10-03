import assert from 'node:assert/strict';
import test from 'node:test';
import {planExportDimensions} from '../sauceapproved-studio/vintage-camera/export-dimensions.mjs';

test('keeps smaller clips at native resolution without upscaling',()=>{
  assert.deepEqual(
    planExportDimensions({sourceWidth:640,sourceHeight:360}),
    {width:640,height:360,scale:1,upscaled:false,reason:'native_dimensions'}
  );
});

test('preserves portrait aspect while bounding the long edge',()=>{
  assert.deepEqual(
    planExportDimensions({sourceWidth:1080,sourceHeight:1920}),
    {width:720,height:1280,scale:0.6667,upscaled:false,reason:'bounded_native_aspect'}
  );
});

test('bounds large landscape clips and returns even encoder dimensions',()=>{
  const result=planExportDimensions({sourceWidth:3840,sourceHeight:2160});
  assert.equal(result.width,1280);
  assert.equal(result.height,720);
  assert.equal(result.upscaled,false);
  assert.equal(result.reason,'bounded_native_aspect');
  assert.equal(result.width%2,0);
  assert.equal(result.height%2,0);
});

test('uses a safe fallback when source metadata is unavailable',()=>{
  assert.deepEqual(
    planExportDimensions({sourceWidth:0,sourceHeight:0}),
    {width:1280,height:720,scale:1,upscaled:false,reason:'source_dimensions_unavailable'}
  );
});
