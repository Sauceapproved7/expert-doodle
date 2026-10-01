export function resolveReleaseTruthStorageConfig({
 environment="development",
 path,
 durableMountVerified=false
}={}){
 if(!path||typeof path!=="string") throw new Error("release_truth_storage_path_required");
 const production=environment==="production";
 if(production&&durableMountVerified!==true) throw new Error("release_truth_durable_mount_required");
 return Object.freeze({
  schema:"sauceapproved.studio.release-truth-storage/v1",
  environment,
  path,
  durable:production&&durableMountVerified===true,
  verifiedMount:durableMountVerified===true,
  failClosed:true,
  claimPolicy:"durable-only-when-mount-explicitly-verified"
 });
}
