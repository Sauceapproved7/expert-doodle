import assert from 'node:assert/strict';
import test from 'node:test';
import {createCaptureReceipt} from '../sauceapproved-studio/vintage-camera/capture-receipt.mjs';

test('produces a local quality receipt without source footage or device identity',()=>{
  const receipt=createCaptureReceipt({
    mode:'clip',frames:75,elapsedMs:5000,interrupted:false,
    blobSize:200000,mimeType:'video/webm',width:1280,height:720,
    look:{stock:'silver-noir',strength:55,grain:28}
  });
  assert.deepEqual(receipt,{
    schema:'sauceapproved.vintage-camera.capture-receipt',version:1,
    mode:'clip',quality:{ok:true,reason:null,renderedFps:15,renderedFrames:75,elapsedMs:5000},
    output:{mimeType:'video/webm',bytes:200000,width:1280,height:720},
    look:{stock:'silver-noir',strength:55,grain:28},
    measurement:'Browser render cadence only; inspect downloaded video for encoded frame rate and duration.'
  });
  assert.equal(JSON.stringify(receipt).includes('sourceMedia'),false);
});

test('records an interrupted preview and rejects malformed measurements',()=>{
  const receipt=createCaptureReceipt({mode:'camera',frames:60,elapsedMs:3000,interrupted:true,
    blobSize:1000,mimeType:'video/webm',width:1280,height:720,
    look:{stock:'street-tape',strength:40,grain:10}});
  assert.equal(receipt.quality.ok,false);
  assert.equal(receipt.quality.reason,'capture_interrupted');
  assert.throws(()=>createCaptureReceipt({mode:'clip',frames:-1,elapsedMs:0,blobSize:-1,
    mimeType:'text/html',width:0,height:0,look:{stock:'x',strength:0,grain:0}}));
});
