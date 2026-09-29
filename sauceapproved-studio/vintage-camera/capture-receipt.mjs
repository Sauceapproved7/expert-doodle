import {assessCapture} from './capture-quality.mjs';

export function createCaptureReceipt({mode,frames,elapsedMs,interrupted=false,blobSize,mimeType,width,height,look}={}) {
  const quality=assessCapture({frames,elapsedMs,interrupted});
  if (!['camera','clip'].includes(mode) || !Number.isSafeInteger(frames) || frames<0 ||
      !Number.isFinite(elapsedMs) || elapsedMs<=0 || !Number.isSafeInteger(blobSize) || blobSize<=0 ||
      !/^video\/webm(?:;.*)?$/i.test(mimeType||'') || !Number.isSafeInteger(width) || width<=0 ||
      !Number.isSafeInteger(height) || height<=0 ||
      !['golden-hour','street-tape','silver-noir','clean-archive'].includes(look?.stock) ||
      !Number.isFinite(look.strength) || look.strength<0 || look.strength>100 ||
      !Number.isFinite(look.grain) || look.grain<0 || look.grain>70) {
    throw new TypeError('Invalid capture receipt input');
  }
  return {
    schema:'sauceapproved.vintage-camera.capture-receipt',version:1,
    mode,quality:{ok:quality.ok,reason:quality.reason,renderedFps:quality.fps,renderedFrames:frames,elapsedMs},
    output:{mimeType,bytes:blobSize,width,height},
    look:{stock:look.stock,strength:look.strength,grain:look.grain},
    measurement:'Browser render cadence only; inspect downloaded video for encoded frame rate and duration.'
  };
}
