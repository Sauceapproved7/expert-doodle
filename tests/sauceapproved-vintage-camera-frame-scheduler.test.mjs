import assert from 'node:assert/strict';
import test from 'node:test';
import {scheduleVideoFrame,cancelScheduledVideoFrame} from '../sauceapproved-studio/vintage-camera/frame-scheduler.mjs';

test('uses decoded-video frame callbacks while playable video is running',()=>{
  let callbackSeen=null;
  const video={
    readyState:4,
    paused:false,
    requestVideoFrameCallback(callback){callbackSeen=callback;return 42;},
    cancelVideoFrameCallback(id){assert.equal(id,42);}
  };
  const scheduled=scheduleVideoFrame(video,()=>{},()=>{throw new Error('animation fallback should not run');});
  assert.deepEqual(scheduled,{kind:'video',id:42});
  assert.equal(typeof callbackSeen,'function');
  cancelScheduledVideoFrame(video,scheduled,()=>{throw new Error('animation cancel should not run');});
});

test('falls back to animation frames before playback or when video callbacks are unavailable',()=>{
  const requestAnimationFrame=callback=>{assert.equal(typeof callback,'function');return 7;};
  const cancelAnimationFrame=id=>assert.equal(id,7);

  const pausedVideo={readyState:4,paused:true,requestVideoFrameCallback(){throw new Error('paused video should not schedule decoded frames');}};
  const paused=scheduleVideoFrame(pausedVideo,()=>{},requestAnimationFrame);
  assert.deepEqual(paused,{kind:'animation',id:7});
  cancelScheduledVideoFrame(pausedVideo,paused,cancelAnimationFrame);

  const legacyVideo={readyState:4,paused:false};
  const legacy=scheduleVideoFrame(legacyVideo,()=>{},requestAnimationFrame);
  assert.deepEqual(legacy,{kind:'animation',id:7});
});
