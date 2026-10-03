import {normalizeWindowsDiagnostics} from "./windows-diagnostics.mjs";

export async function collectWindowsDiagnostics({probe}={}){
  if(typeof probe!=="function") throw new TypeError("read-only Windows probe required");
  const raw=await probe();
  return normalizeWindowsDiagnostics(raw);
}
