export function scheduleVideoFrame(video,callback,requestAnimationFrameFn=globalThis.requestAnimationFrame){
  const canUseVideoFrames=video
    && video.readyState>=2
    && !video.paused
    && typeof video.requestVideoFrameCallback==='function';
  if(canUseVideoFrames){
    return {kind:'video',id:video.requestVideoFrameCallback(callback)};
  }
  return {kind:'animation',id:requestAnimationFrameFn(callback)};
}

export function cancelScheduledVideoFrame(video,scheduled,cancelAnimationFrameFn=globalThis.cancelAnimationFrame){
  if(!scheduled)return;
  if(scheduled.kind==='video'&&typeof video?.cancelVideoFrameCallback==='function'){
    video.cancelVideoFrameCallback(scheduled.id);
    return;
  }
  if(scheduled.kind==='animation')cancelAnimationFrameFn(scheduled.id);
}
