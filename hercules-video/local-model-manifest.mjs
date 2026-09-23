import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {readFile,stat} from "node:fs/promises";
import path from "node:path";
import {fingerprint} from "./core.mjs";

function absolute(value,name) {
  const raw=String(value||"");
  if (!raw || !path.isAbsolute(raw)) throw new Error(name);
  return path.normalize(raw);
}

function sha256(value,name) {
  const hash=String(value||"").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(name);
  return hash;
}

function safeRelative(value,index) {
  const raw=String(value||"");
  if (!raw || path.isAbsolute(raw)) throw new Error("model_manifest_path_invalid:"+index);
  const normalized=path.normalize(raw);
  if (normalized===".." || normalized.startsWith(".."+path.sep)) throw new Error("model_manifest_path_escape:"+index);
  return normalized;
}

async function hashFile(filePath) {
  return await new Promise((resolve,reject)=>{
    const hash=createHash("sha256");
    const stream=createReadStream(filePath);
    stream.on("error",reject);
    stream.on("data",chunk=>hash.update(chunk));
    stream.on("end",()=>resolve(hash.digest("hex")));
  });
}

export async function loadLocalModelManifest({
  modelDir,
  manifestPath,
  readFileImpl=readFile,
}={}) {
  const root=absolute(modelDir,"model_manifest_model_dir_required");
  const file=absolute(manifestPath,"model_manifest_path_required");
  const relative=path.relative(root,file);
  if (relative===".." || relative.startsWith(".."+path.sep) || path.isAbsolute(relative)) {
    throw new Error("model_manifest_outside_model_dir");
  }

  const parsed=JSON.parse(await readFileImpl(file,"utf8"));
  if (parsed?.schema!=="sauceapproved.hercules.video-local-model-manifest") {
    throw new Error("model_manifest_schema_invalid");
  }
  if (Number(parsed.version)!==1) throw new Error("model_manifest_version_invalid");
  if (!String(parsed.modelId||"").trim()) throw new Error("model_manifest_model_id_required");
  if (!String(parsed.revision||"").trim()) throw new Error("model_manifest_revision_required");
  if (!String(parsed.license||"").trim()) throw new Error("model_manifest_license_required");
  if (!Array.isArray(parsed.files) || parsed.files.length===0 || parsed.files.length>512) {
    throw new Error("model_manifest_files_invalid");
  }

  const seen=new Set();
  const files=parsed.files.map((entry,index)=>{
    if (!entry || typeof entry!=="object") throw new Error("model_manifest_file_invalid:"+index);
    const relativePath=safeRelative(entry.path,index);
    if (seen.has(relativePath)) throw new Error("model_manifest_duplicate_path:"+relativePath);
    seen.add(relativePath);
    const sizeBytes=Number(entry.sizeBytes);
    if (!Number.isInteger(sizeBytes) || sizeBytes<=0) throw new Error("model_manifest_size_invalid:"+index);
    return {
      path:relativePath,
      sizeBytes,
      sha256:sha256(entry.sha256,"model_manifest_sha256_invalid:"+index),
    };
  });

  const normalized={
    schema:parsed.schema,
    version:1,
    modelId:String(parsed.modelId),
    revision:String(parsed.revision),
    license:String(parsed.license).toLowerCase(),
    files,
  };
  return {...normalized,fingerprint:fingerprint(normalized)};
}

export async function verifyLocalModelManifest({
  modelDir,
  manifestPath,
  expectedModelId=null,
  expectedLicense=null,
  readFileImpl=readFile,
  statImpl=stat,
  hashFileImpl=hashFile,
}={}) {
  const root=absolute(modelDir,"model_manifest_model_dir_required");
  const manifest=await loadLocalModelManifest({modelDir:root,manifestPath,readFileImpl});
  if (expectedModelId && manifest.modelId!==expectedModelId) throw new Error("model_manifest_model_id_mismatch");
  if (expectedLicense && manifest.license!==String(expectedLicense).toLowerCase()) {
    throw new Error("model_manifest_license_mismatch");
  }

  const verified=[];
  for (const entry of manifest.files) {
    const filePath=path.join(root,entry.path);
    const info=await statImpl(filePath).catch(()=>null);
    if (!info?.isFile()) throw new Error("model_manifest_file_missing:"+entry.path);
    if (info.size!==entry.sizeBytes) throw new Error("model_manifest_file_size_mismatch:"+entry.path);
    const actual=await hashFileImpl(filePath);
    if (actual!==entry.sha256) throw new Error("model_manifest_file_hash_mismatch:"+entry.path);
    verified.push({path:entry.path,sizeBytes:entry.sizeBytes,sha256:entry.sha256});
  }

  const evidence={
    schema:"sauceapproved.hercules.video-local-model-evidence",
    version:1,
    modelId:manifest.modelId,
    revision:manifest.revision,
    license:manifest.license,
    manifestFingerprint:manifest.fingerprint,
    verifiedFiles:verified,
  };
  return {...evidence,fingerprint:fingerprint(evidence)};
}
