const REQUIRED_LOOKS=['golden-hour','street-tape','silver-noir','clean-archive'];

const DEVICE_PROOF_LABELS={
  cameraOpened:'open the camera',
  allLooksUsed:'use all four looks',
  cameraCapturePassed:'pass camera capture QA',
  clipCapturePassed:'pass loaded-clip QA',
  cameraPlaybackConfirmed:'confirm camera export playback',
  clipPlaybackConfirmed:'confirm loaded-clip export playback',
  originalAvailable:'preserve an original clip'
};

export function describeMissingDeviceProof(receipt={}){
  const missing=Array.isArray(receipt.missing)?receipt.missing:[];
  return missing.map(key=>DEVICE_PROOF_LABELS[key]||key);
}

export function createDeviceProofReceipt({
  cameraOpened=false,looksUsed=[],cameraReceipt=null,clipReceipt=null,
  cameraPlaybackConfirmed=false,clipPlaybackConfirmed=false,originalAvailable=false
}={}){
  const used=new Set(Array.isArray(looksUsed)?looksUsed:[]);
  const checks={
    cameraOpened:cameraOpened===true,
    allLooksUsed:REQUIRED_LOOKS.every(look=>used.has(look)),
    cameraCapturePassed:cameraReceipt?.mode==='camera'&&cameraReceipt?.quality?.ok===true,
    clipCapturePassed:clipReceipt?.mode==='clip'&&clipReceipt?.quality?.ok===true,
    cameraPlaybackConfirmed:cameraPlaybackConfirmed===true,
    clipPlaybackConfirmed:clipPlaybackConfirmed===true,
    originalAvailable:originalAvailable===true
  };
  const missing=Object.entries(checks).filter(([,passed])=>!passed).map(([key])=>key);
  const ok=missing.length===0;
  return {
    schema:'sauceapproved.vintage-camera.device-proof',
    version:1,
    ok,
    reason:ok?null:'device_proof_incomplete',
    checks,
    missing,
    evidence:{
      camera:cameraReceipt||null,
      clip:clipReceipt||null
    },
    note:'Playback confirmations are explicit operator attestations; no footage or device identifier is included.'
  };
}

export function serializeDeviceProofState({cameraOpened=false,looksUsed=[],cameraReceipt=null,clipReceipt=null,cameraPlaybackConfirmed=false,clipPlaybackConfirmed=false,originalPreserved=false}={}){
  return JSON.stringify({version:1,cameraOpened:cameraOpened===true,looksUsed:[...new Set(Array.isArray(looksUsed)?looksUsed:[])],cameraReceipt:cameraReceipt||null,clipReceipt:clipReceipt||null,cameraPlaybackConfirmed:cameraPlaybackConfirmed===true,clipPlaybackConfirmed:clipPlaybackConfirmed===true,originalPreserved:originalPreserved===true});
}

export function parseDeviceProofState(value){
  try{
    const state=JSON.parse(String(value||''));
    if(state?.version!==1)return null;
    return {cameraOpened:state.cameraOpened===true,looksUsed:Array.isArray(state.looksUsed)?state.looksUsed:[],cameraReceipt:state.cameraReceipt||null,clipReceipt:state.clipReceipt||null,cameraPlaybackConfirmed:state.cameraPlaybackConfirmed===true,clipPlaybackConfirmed:state.clipPlaybackConfirmed===true,originalPreserved:state.originalPreserved===true};
  }catch{return null;}
}
