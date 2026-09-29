export function assessCapture({frames,elapsedMs}={}) {
  if (!Number.isFinite(frames) || !Number.isFinite(elapsedMs) || frames<0 || elapsedMs<=0) {
    return {ok:false,fps:0,reason:'invalid_capture_metrics'};
  }
  const fps=Math.round(frames*10000/elapsedMs)/10;
  if (frames===0) return {ok:false,fps,reason:'no_rendered_frames'};
  if (elapsedMs<500) return {ok:false,fps,reason:'capture_too_short'};
  if (fps<12) return {ok:false,fps,reason:'low_frame_cadence'};
  return {ok:true,fps,reason:null};
}
