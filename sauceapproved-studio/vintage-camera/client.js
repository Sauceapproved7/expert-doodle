import {assessCapture} from './capture-quality.mjs';
import {createCaptureReceipt} from './capture-receipt.mjs';
import {scheduleVideoFrame,cancelScheduledVideoFrame} from './frame-scheduler.mjs';
import {createDeviceProofReceipt,describeMissingDeviceProof,serializeDeviceProofState,parseDeviceProofState} from './device-proof.mjs';
import {planExportDimensions} from './export-dimensions.mjs';

const $=id=>document.getElementById(id);
const source=$('source'),view=$('view'),preview=view.getContext('2d',{alpha:false});
const output=document.createElement('canvas');output.width=1280;output.height=720;
const frame=output.getContext('2d',{alpha:false});
function configureOutputForSource(){
  const plan=planExportDimensions({sourceWidth:source.videoWidth,sourceHeight:source.videoHeight});
  if(output.width!==plan.width)output.width=plan.width;
  if(output.height!==plan.height)output.height=plan.height;
  return plan;
}
const grainTextures=Array.from({length:16},()=>{
  const texture=document.createElement('canvas');texture.width=160;texture.height=90;
  const context=texture.getContext('2d'),pixels=context.createImageData(160,90);
  for(let i=0;i<pixels.data.length;i+=4){
    const value=Math.floor(Math.random()*256);
    pixels.data[i]=value;pixels.data[i+1]=value;pixels.data[i+2]=value;pixels.data[i+3]=255;
  }
  context.putImageData(pixels,0,0);return texture;
});
let cameraStream=null,sourceUrl=null,sourceName=null,originalUrl=null,processedUrl=null,recorder=null,rawRecorder=null;
let recordingStarted=0,recordingEnded=0,renderedFrames=0,captureInterrupted=false,recordingFinalizing=false,grainIndex=0,scheduledFrame=null,mode='idle',captureMode='idle',captureLook=null,captureReceipt=null,chunks=[],rawChunks=[];
const PROOF_STATE_KEY='sauceapproved.vintage-camera.device-proof.progress.v1';
const restoredProof=parseDeviceProofState(localStorage.getItem(PROOF_STATE_KEY));
const deviceProof={cameraOpened:restoredProof?.cameraOpened||false,looksUsed:new Set(restoredProof?.looksUsed||[]),cameraReceipt:restoredProof?.cameraReceipt||null,clipReceipt:restoredProof?.clipReceipt||null,originalPreserved:restoredProof?.originalPreserved||false};
const persistDeviceProof=()=>localStorage.setItem(PROOF_STATE_KEY,serializeDeviceProofState({...deviceProof,looksUsed:[...deviceProof.looksUsed],cameraPlaybackConfirmed:$('camera-playback')?.checked||restoredProof?.cameraPlaybackConfirmed||false,clipPlaybackConfirmed:$('clip-playback')?.checked||restoredProof?.clipPlaybackConfirmed||false}));
const setStatus=message=>{$('status').textContent=message;};
const setButtonState=()=>{
  const ready=mode==='camera'||mode==='clip';
  $('camera').disabled=mode==='recording'||recordingFinalizing;$('load').disabled=mode==='recording'||recordingFinalizing;
  $('record').disabled=!ready||recordingFinalizing||typeof MediaRecorder==='undefined'||!HTMLCanvasElement.prototype.captureStream;
  $('stop').disabled=mode==='idle'||recordingFinalizing;$('original').disabled=!originalUrl;
  $('receipt').disabled=!captureReceipt;
  for(const id of ['stock','strength','grain'])$(id).disabled=mode==='recording'||recordingFinalizing;
  $('record').textContent=mode==='clip'?'Process clip':'Record look';
};
const recipe=()=>({schema:'sauceapproved.vintage-camera.recipe',version:1,stock:$('stock').value,strength:Number($('strength').value),grain:Number($('grain').value),export:'webm',sourceMediaIncluded:false});
function filterFor(stock,strength){
  const amount=strength/100;
  const values={
    'golden-hour':`sepia(${.64*amount}) saturate(${1+.2*amount}) contrast(${1+.1*amount}) brightness(${1+.03*amount})`,
    'street-tape':`saturate(${1-.32*amount}) contrast(${1+.17*amount}) hue-rotate(${-5*amount}deg)`,
    'silver-noir':`grayscale(${amount}) contrast(${1+.32*amount}) brightness(${1-.04*amount})`,
    'clean-archive':`sepia(${.2*amount}) contrast(${1+.07*amount}) saturate(${1-.08*amount})`
  };
  return values[stock]||'none';
}
function imageTo(ctx,filter='none'){
  const w=ctx.canvas.width,h=ctx.canvas.height,sw=source.videoWidth,sh=source.videoHeight;
  ctx.fillStyle='#090909';ctx.fillRect(0,0,w,h);
  if(!sw||!sh)return;
  const scale=Math.max(w/sw,h/sh),dw=sw*scale,dh=sh*scale;
  ctx.filter=filter;ctx.drawImage(source,(w-dw)/2,(h-dh)/2,dw,dh);ctx.filter='none';
}
function grainOverlay(ctx,amount){
  if(amount<=0)return;
  ctx.save();ctx.globalAlpha=amount*.55/255;
  ctx.drawImage(grainTextures[grainIndex++%grainTextures.length],0,0,ctx.canvas.width,ctx.canvas.height);
  ctx.restore();
}
function draw(){
  const settings=recipe();
  imageTo(frame,filterFor(settings.stock,settings.strength));
  grainOverlay(frame,settings.grain);
  preview.fillStyle='#090909';preview.fillRect(0,0,view.width,view.height);
  if(source.readyState>=2){
    preview.save();preview.beginPath();preview.rect(0,0,view.width/2,view.height);preview.clip();imageTo(preview);preview.restore();
    preview.save();preview.beginPath();preview.rect(view.width/2,0,view.width/2,view.height);preview.clip();preview.drawImage(output,0,0);preview.restore();
    preview.fillStyle='#e2b68d';preview.fillRect(view.width/2-1,0,2,view.height);
  }else{
    preview.fillStyle='#b49e8a';preview.font='bold 28px system-ui';preview.textAlign='center';
    preview.fillText('A STORY IS WAITING.',view.width/2,view.height/2);
  }
  if(mode==='recording'){
    if(source.readyState>=2)renderedFrames++;
    const seconds=Math.floor((Date.now()-recordingStarted)/1000);
    $('timecode').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  }
  scheduledFrame=scheduleVideoFrame(source,draw);
}
function releaseSource(){
  if(recorder?.state==='recording'){recordingEnded=Date.now();recorder.stop();}
  if(rawRecorder?.state==='recording')rawRecorder.stop();
  if(cameraStream){cameraStream.getTracks().forEach(track=>track.stop());cameraStream=null;}
  source.pause();source.srcObject=null;source.removeAttribute('src');source.load();
  if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null;sourceName=null;}
  mode='idle';setButtonState();
}
function releaseDownloads(){
  if(processedUrl)URL.revokeObjectURL(processedUrl);
  if(originalUrl)URL.revokeObjectURL(originalUrl);
  processedUrl=originalUrl=null;captureReceipt=null;$('download').hidden=true;setButtonState();
}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function supportedMime(){return ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4;codecs=h264,aac','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));}
function extensionForMime(type=''){return /^video\/mp4/i.test(type)?'mp4':'webm';}
$('camera').addEventListener('click',async()=>{
  releaseSource();releaseDownloads();
  if(!navigator.mediaDevices?.getUserMedia){setStatus('This browser cannot open a camera here. Use Load a clip instead.');return;}
  try{
    const wantAudio=$('microphone').checked;
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:wantAudio});
    source.srcObject=cameraStream;source.muted=true;await source.play();configureOutputForSource();mode='camera';deviceProof.cameraOpened=true;deviceProof.looksUsed.add($('stock').value);persistDeviceProof();setButtonState();
    $('finder-label').textContent='LIVE / SOURCE ↔ LOOK';
    setStatus(`Camera live. ${wantAudio?'Microphone enabled by your choice.':'Microphone off.'} Recording has not started.`);
  }catch(error){releaseSource();setStatus(error?.name==='NotAllowedError'?'Camera permission was denied. No capture started.':'Camera unavailable. Try Load a clip.');}
});
$('load').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  if(!file.type.startsWith('video/')){setStatus('Choose a video file. Nothing was uploaded.');return;}
  releaseSource();releaseDownloads();sourceUrl=URL.createObjectURL(file);originalUrl=sourceUrl;sourceName=file.name;
  source.src=sourceUrl;source.loop=false;source.muted=true;
  try{await source.play();const plan=configureOutputForSource();mode='clip';setButtonState();$('finder-label').textContent='CLIP / SOURCE ↔ LOOK';setStatus(`Clip loaded locally. Export preserves source aspect at ${plan.width}×${plan.height} without upscaling. Processing exports video without source audio on this version.`);}
  catch{mode='clip';setButtonState();setStatus('Clip loaded locally. Tap the video processing control to start playback.');}
  event.target.value='';
});
$('record').addEventListener('click',async()=>{
  if(mode!=='camera'&&mode!=='clip')return;
  const mime=supportedMime();if(!mime){setStatus('This browser cannot encode WebM. No recording started.');return;}
  try{
    if(mode==='clip'){source.currentTime=0;await source.play();}
    const exportPlan=configureOutputForSource();
    const stream=output.captureStream(30);
    if(mode==='camera')cameraStream.getAudioTracks().forEach(track=>stream.addTrack(track));
    chunks=[];rawChunks=[];
    recorder=new MediaRecorder(stream,{mimeType:mime});
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.onstop=()=>{
      const quality=assessCapture({frames:renderedFrames,elapsedMs:(recordingEnded||Date.now())-recordingStarted,interrupted:captureInterrupted});
      if(chunks.length){
        const processedBlob=new Blob(chunks,{type:mime});
        captureReceipt=createCaptureReceipt({mode:captureMode,frames:renderedFrames,elapsedMs:(recordingEnded||Date.now())-recordingStarted,
          interrupted:captureInterrupted,blobSize:processedBlob.size,mimeType:mime,width:output.width,height:output.height,look:captureLook});
        if(captureMode==='camera')deviceProof.cameraReceipt=captureReceipt;
        if(captureMode==='clip')deviceProof.clipReceipt=captureReceipt;
        persistDeviceProof();
        processedUrl=URL.createObjectURL(processedBlob);$('download').href=processedUrl;
        $('download').download=`sauceapproved-vintage-look.${extensionForMime(mime)}`;$('download').hidden=false;
        $('download').textContent=quality.ok?'Download processed clip':'Download low-frame-rate preview';
        setStatus(quality.ok?'Processed clip ready to download. The source stayed local.':quality.reason==='capture_interrupted'?'Capture interrupted when the tab was hidden. This is only a preview; keep the tab active and record again before using the clip.':`Capture quality warning: ${quality.fps} rendered frames per second. Keep this tab active and try again before using the clip. This preview is not a verified full-quality export.`);
      }else setStatus('No video data was recorded. No processed clip is available.');
      stream.getVideoTracks().forEach(track=>track.stop());
      recordingFinalizing=false;setButtonState();
    };
    if(mode==='camera'){
      rawRecorder=new MediaRecorder(cameraStream,{mimeType:mime});
      rawRecorder.ondataavailable=event=>{if(event.data.size)rawChunks.push(event.data);};
      rawRecorder.onstop=()=>{if(rawChunks.length){originalUrl=URL.createObjectURL(new Blob(rawChunks,{type:mime}));setButtonState();}};
      rawRecorder.start(1000);
    }
    captureMode=mode;captureLook=recipe();captureReceipt=null;
    recorder.start(1000);mode='recording';recordingStarted=Date.now();recordingEnded=0;renderedFrames=0;captureInterrupted=false;setButtonState();
    setStatus(`Recording locally at ${exportPlan.width}×${exportPlan.height} without upscaling. Stop to finish and download.`);
  }catch{if(rawRecorder?.state==='recording')rawRecorder.stop();setStatus('Recording could not start on this browser.');}
});
$('stop').addEventListener('click',()=>{
  if(mode==='recording'){
    recordingEnded=Date.now();
    recordingFinalizing=true;
    if(recorder?.state==='recording')recorder.stop();
    if(rawRecorder?.state==='recording')rawRecorder.stop();
    mode=cameraStream?'camera':'clip';
  }else{releaseSource();setStatus('Camera stopped. Nothing was sent to a server.');}
  if(mode==='clip'){source.pause();source.currentTime=0;}
  setButtonState();
});
source.addEventListener('ended',()=>{if(mode==='recording'&&!cameraStream)$('stop').click();});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&mode==='recording'){
    captureInterrupted=true;$('stop').click();
  }
});
$('recipe').addEventListener('click',()=>saveBlob(new Blob([JSON.stringify(recipe(),null,2)],{type:'application/json'}),'sauceapproved-look-recipe.json'));
$('receipt').addEventListener('click',()=>{if(captureReceipt)saveBlob(new Blob([JSON.stringify(captureReceipt,null,2)],{type:'application/json'}),'sauceapproved-capture-qa.json');});
$('original').addEventListener('click',()=>{if(!originalUrl)return;const link=document.createElement('a');link.href=originalUrl;link.download=sourceName||`sauceapproved-original.${extensionForMime(rawRecorder?.mimeType||'')}`;link.click();deviceProof.originalPreserved=true;persistDeviceProof();});
$('stock').addEventListener('change',()=>{deviceProof.looksUsed.add($('stock').value);persistDeviceProof();});
for(const id of ['strength','grain'])$(id).addEventListener('input',()=>{$(id+'-value').value=$(id).value+'%';});
$('device-proof').addEventListener('click',()=>{
  const proof=createDeviceProofReceipt({
    cameraOpened:deviceProof.cameraOpened,
    looksUsed:[...deviceProof.looksUsed],
    cameraReceipt:deviceProof.cameraReceipt,
    clipReceipt:deviceProof.clipReceipt,
    cameraPlaybackConfirmed:$('camera-playback').checked,
    clipPlaybackConfirmed:$('clip-playback').checked,
    originalAvailable:deviceProof.originalPreserved===true
  });
  saveBlob(new Blob([JSON.stringify(proof,null,2)],{type:'application/json'}),'sauceapproved-device-proof.json');
  const missing=describeMissingDeviceProof(proof);
  setStatus(proof.ok?'Device proof passed. Save this receipt with your launch evidence.':`Device proof incomplete: ${missing.join('; ')}.`);
});
$('camera-playback').checked=restoredProof?.cameraPlaybackConfirmed||false;
$('clip-playback').checked=restoredProof?.clipPlaybackConfirmed||false;
for(const id of ['camera-playback','clip-playback'])$(id).addEventListener('change',persistDeviceProof);
window.addEventListener('pagehide',()=>{cancelScheduledVideoFrame(source,scheduledFrame);releaseSource();releaseDownloads();});
setButtonState();draw();
