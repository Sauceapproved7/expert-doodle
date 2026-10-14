(() => {
  'use strict';
  // Aggregate, session-only counters. Never accepts or retains image, video or landmark coordinates.
  function createSession(mode) {
    if(mode!=='face' && mode!=='hand')throw new TypeError('Invalid AR mode');
    let samples=0, detections=0, totalInferenceMs=0, firstFrameMs=null, lastFrameMs=null;
    function record(inferenceMs, detected, frameMs) {
      if(!Number.isFinite(inferenceMs)||inferenceMs<0||!Number.isFinite(frameMs)||frameMs<0)return false;
      if(lastFrameMs!==null&&frameMs<=lastFrameMs)return false;
      firstFrameMs ??= frameMs;
      lastFrameMs=frameMs;
      samples++;
      if(detected===true)detections++;
      totalInferenceMs+=inferenceMs;
      return true;
    }
    function snapshot() {
      const observedSeconds=firstFrameMs!==null&&lastFrameMs>firstFrameMs?(lastFrameMs-firstFrameMs)/1000:null;
      return Object.freeze({
        schema:1,
        mode,
        samples,
        detectedSamples:detections,
        detectionPercent:samples?Math.round(detections/samples*1000)/10:null,
        meanInferenceMs:samples?Math.round(totalInferenceMs/samples*10)/10:null,
        sampleRateHz:observedSeconds&&samples>=2?Math.round((samples-1)/observedSeconds*10)/10:null,
        validity:samples<30?'insufficient-samples':'observational-only',
        accuracyCertified:false
      });
    }
    return Object.freeze({record,snapshot});
  }
  Object.defineProperty(window,'GlowArMetrics',{value:Object.freeze({createSession}),writable:false,configurable:false});
})();