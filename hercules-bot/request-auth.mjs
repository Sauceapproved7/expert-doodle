export function createSmallzRequestAuth({authorization,body}={}){
 const ownerAuthorization=String(authorization||"").trim();
 if(!ownerAuthorization.startsWith("Bearer ")||ownerAuthorization.length<=7)throw new Error("owner authorization required");
 return Object.freeze({ownerAuthorization,body:body&&typeof body==="object"?structuredClone(body):{}});
}
