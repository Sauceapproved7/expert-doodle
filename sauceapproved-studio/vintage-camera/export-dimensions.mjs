export function planExportDimensions({sourceWidth,sourceHeight,maxLongEdge=1280,maxPixels=1280*1280}={}){
  const sw=Math.max(0,Math.floor(Number(sourceWidth)||0));
  const sh=Math.max(0,Math.floor(Number(sourceHeight)||0));
  if(!sw||!sh)return {width:1280,height:720,scale:1,upscaled:false,reason:"source_dimensions_unavailable"};

  const longEdge=Math.max(sw,sh);
  const longScale=Math.min(1,maxLongEdge/longEdge);
  const pixelScale=Math.min(1,Math.sqrt(maxPixels/(sw*sh)));
  const scale=Math.min(longScale,pixelScale);

  const even=value=>Math.max(2,Math.round(value/2)*2);
  const width=even(sw*scale);
  const height=even(sh*scale);

  return {
    width,
    height,
    scale:Math.round(scale*10000)/10000,
    upscaled:false,
    reason:scale<1?"bounded_native_aspect":"native_dimensions"
  };
}
