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

import {serializeDeviceProofState,parseDeviceProofState} from '../sauceapproved-studio/vintage-camera/device-proof.mjs';

test('device proof progress survives a local page reload without footage or device identity',()=>{
  const encoded=serializeDeviceProofState({cameraOpened:true,looksUsed:['golden-hour','street-tape'],cameraReceipt:{mode:'camera',quality:{ok:true}},cameraPlaybackConfirmed:true,originalPreserved:true});
  assert.equal(encoded.includes('footage'),false);
  assert.deepEqual(parseDeviceProofState(encoded),{cameraOpened:true,looksUsed:['golden-hour','street-tape'],cameraReceipt:{mode:'camera',quality:{ok:true}},clipReceipt:null,cameraPlaybackConfirmed:true,clipPlaybackConfirmed:false,originalPreserved:true});
});

test('invalid persisted proof state fails closed',()=>{assert.equal(parseDeviceProofState('{bad'),null);});

import {createCaptureReceipt} from '../sauceapproved-studio/vintage-camera/capture-receipt.mjs';

test('accepts browser-supported MP4 receipts for iPhone capture proof',()=>{
  const receipt=createCaptureReceipt({mode:'camera',frames:60,elapsedMs:3000,blobSize:1024,mimeType:'video/mp4',width:1280,height:720,look:{stock:'golden-hour',strength:55,grain:28}});
  assert.equal(receipt.output.mimeType,'video/mp4');
});
