const REQUIRED_LOOKS=['golden-hour','street-tape','silver-noir','clean-archive'];

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
  const ok=Object.values(checks).every(Boolean);
  return {
    schema:'sauceapproved.vintage-camera.device-proof',
    version:1,
    ok,
    reason:ok?null:'device_proof_incomplete',
    checks,
    evidence:{
      camera:cameraReceipt||null,
      clip:clipReceipt||null
    },
    note:'Playback confirmations are explicit operator attestations; no footage or device identifier is included.'
  };
}
