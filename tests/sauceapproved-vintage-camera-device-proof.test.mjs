import assert from 'node:assert/strict';
import test from 'node:test';
import {createDeviceProofReceipt,describeMissingDeviceProof} from '../sauceapproved-studio/vintage-camera/device-proof.mjs';

test('passes only when camera, clip, looks and playback checks all pass',()=>{
  const receipt=createDeviceProofReceipt({
    cameraOpened:true,
    looksUsed:['golden-hour','street-tape','silver-noir','clean-archive'],
    cameraReceipt:{quality:{ok:true},mode:'camera'},
    clipReceipt:{quality:{ok:true},mode:'clip'},
    cameraPlaybackConfirmed:true,
    clipPlaybackConfirmed:true,
    originalAvailable:true
  });
  assert.equal(receipt.ok,true);
  assert.equal(receipt.reason,null);
  assert.deepEqual(receipt.checks,{
    cameraOpened:true,
    allLooksUsed:true,
    cameraCapturePassed:true,
    clipCapturePassed:true,
    cameraPlaybackConfirmed:true,
    clipPlaybackConfirmed:true,
    originalAvailable:true
  });
  assert.equal(receipt.schema,'sauceapproved.vintage-camera.device-proof');
  assert.deepEqual(receipt.missing,[]);
});

test('fails closed when any required proof is missing',()=>{
  const receipt=createDeviceProofReceipt({
    cameraOpened:true,
    looksUsed:['golden-hour','street-tape'],
    cameraReceipt:{quality:{ok:true},mode:'camera'},
    clipReceipt:null,
    cameraPlaybackConfirmed:false,
    clipPlaybackConfirmed:false,
    originalAvailable:false
  });
  assert.equal(receipt.ok,false);
  assert.equal(receipt.reason,'device_proof_incomplete');
  assert.equal(receipt.checks.allLooksUsed,false);
  assert.equal(receipt.checks.clipCapturePassed,false);
  assert.deepEqual(receipt.missing,[
    'allLooksUsed','clipCapturePassed','cameraPlaybackConfirmed','clipPlaybackConfirmed','originalAvailable'
  ]);
});

test('missing checks are translated into operator-readable next actions',()=>{
  assert.deepEqual(describeMissingDeviceProof({missing:['allLooksUsed','cameraCapturePassed','originalAvailable']}),[
    'use all four looks',
    'pass camera capture QA',
    'preserve an original clip'
  ]);
});
