import {createHash,randomBytes} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";

export function normalizeBucketName(value){
  if(typeof value!=="string")throw new TypeError("bucket name is required");
  const name=value.trim().toLowerCase();
  if(name.length<3||name.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/.test(name)){
    throw new TypeError("bucket name is invalid");
  }
  return name;
}

export function normalizeObjectKey(value){
  if(typeof value!=="string")throw new TypeError("object key is required");
  let key;
  try{key=decodeURIComponent(value);}catch{throw new TypeError("object key is invalid");}
  if(!key||key.length>1024||key.startsWith("/")||key.includes("\\")||key.includes("\0")){
    throw new TypeError("object key is invalid");
  }
  const parts=key.split("/");
  if(parts.some((part)=>!part||part==="."||part===".."||part.length>255)){
    throw new TypeError("object key is invalid");
  }
  return parts.join("/");
}

export function sha256Hex(bytes){
  return createHash("sha256").update(bytes).digest("hex");
}

export function createFilesystemBlobStore({root}={}){
  if(typeof root!=="string"||!root.trim())throw new TypeError("storage root is required");
  const canonicalRoot=resolve(root);

  return Object.freeze({
    async put(input){
      const bytes=Buffer.from(input);
      const sha256=sha256Hex(bytes);
      const directory=join(canonicalRoot,sha256.slice(0,2));
      const path=join(directory,sha256);
      await mkdir(directory,{recursive:true});
      try{
        await writeFile(path,bytes,{flag:"wx",mode:0o600});
      }catch(error){
        if(error?.code!=="EEXIST")throw error;
      }
      return Object.freeze({
        sha256,
        sizeBytes:bytes.byteLength,
        path,
      });
    },
    pathForDigest(digest){
      if(typeof digest!=="string"||!/^[a-f0-9]{64}$/.test(digest)){
        throw new TypeError("blob digest is invalid");
      }
      return join(canonicalRoot,digest.slice(0,2),digest);
    },
  });
}
