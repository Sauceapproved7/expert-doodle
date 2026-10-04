import {createHash} from "node:crypto";
import {readFile,stat} from "node:fs/promises";
import path from "node:path";

const SCHEMA="sauceapproved.hercules.video-local-model-manifest";
const SHA256=/^[a-f0-9]{64}$/;

function fingerprint(value) {
  const stable=input=>{
    if (Array.isArray(input)) return "["+input.map(stable).join(",")+"]";
    if (input && typeof input==="object") return "{"+Object.keys(input).sort().map(k=>JSON.stringify(k)+":"+stable(input[k])).join(",")+"}";
    return JSON.stringify(input);
  };
  return createHash("sha256").update(stable(value)).digest("hex");
}

function requireText(value,error) {
  const text=String(value??"").trim();
  if (!text) throw new Error(error);
  return text;
}

function resolveContained(root,relative) {
  const name=requireText(relative,"model_manifest_file_path_required");
  if (path.isAbsolute(name)) throw new Error("model_manifest_path_escape");
  const resolved=path.resolve(root,name);
  const rel=path.relative(root,resolved);
  if (rel.startsWith(".."+path.sep) || rel===".." || path.isAbsolute(rel)) throw new Error("model_manifest_path_escape");
  return resolved;
}

export async function loadLocalModelManifest({modelDir,manifestPath}={}) {
  const root=path.resolve(requireText(modelDir,"model_manifest_model_dir_required"));
  const file=path.resolve(requireText(manifestPath,"model_manifest_path_required"));
  let manifest;
  try { manifest=JSON.parse(await readFile(file,"utf8")); }
  catch { throw new Error("model_manifest_invalid_json"); }
  if (manifest?.schema!==SCHEMA || manifest?.version!==1) throw new Error("model_manifest_schema_invalid");
  const normalized={
    schema:SCHEMA,
    version:1,
    modelId:requireText(manifest.modelId,"model_manifest_model_id_required"),
    revision:requireText(manifest.revision,"model_manifest_revision_required"),
    license:requireText(manifest.license,"model_manifest_license_required").toLowerCase(),
    files:Array.isArray(manifest.files)?manifest.files.map(entry=>{
      if (!entry || typeof entry!=="object") throw new Error("model_manifest_file_invalid");
      const relative=requireText(entry.path,"model_manifest_file_path_required");
      resolveContained(root,relative);
      const sizeBytes=Number(entry.sizeBytes);
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes<0) throw new Error("model_manifest_file_size_invalid");
      const sha256=String(entry.sha256??"").toLowerCase();
      if (!SHA256.test(sha256)) throw new Error("model_manifest_file_sha256_invalid");
      return {path:relative,sizeBytes,sha256};
    }):null,
  };
  if (!normalized.files?.length) throw new Error("model_manifest_files_required");
  const names=new Set();
  for (const entry of normalized.files) {
    if (names.has(entry.path)) throw new Error("model_manifest_duplicate_file");
    names.add(entry.path);
  }
  return normalized;
}

export async function verifyLocalModelManifest({
  modelDir,manifestPath,expectedModelId,expectedLicense,
}={}) {
  const root=path.resolve(requireText(modelDir,"model_manifest_model_dir_required"));
  const manifest=await loadLocalModelManifest({modelDir:root,manifestPath});
  if (expectedModelId!=null && manifest.modelId!==String(expectedModelId)) throw new Error("model_manifest_model_id_mismatch");
  if (expectedLicense!=null && manifest.license!==String(expectedLicense).trim().toLowerCase()) throw new Error("model_manifest_license_mismatch");
  const verifiedFiles=[];
  for (const entry of manifest.files) {
    const file=resolveContained(root,entry.path);
    const info=await stat(file).catch(()=>null);
    if (!info?.isFile()) throw new Error("model_manifest_file_missing");
    if (info.size!==entry.sizeBytes) throw new Error("model_manifest_file_size_mismatch");
    const digest=createHash("sha256").update(await readFile(file)).digest("hex");
    if (digest!==entry.sha256) throw new Error("model_manifest_file_hash_mismatch");
    verifiedFiles.push({path:entry.path,sizeBytes:entry.sizeBytes,sha256:digest});
  }
  const evidence={
    schema:"sauceapproved.hercules.video-local-model-evidence",
    version:1,
    modelId:manifest.modelId,
    revision:manifest.revision,
    license:manifest.license,
    verifiedFiles,
  };
  return {...evidence,manifestFingerprint:fingerprint(evidence)};
}
