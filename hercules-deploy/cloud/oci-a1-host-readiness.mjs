// Original Hercules Cloud OCI A1 host *local observation* evaluator.
// NO network, subprocess, provider SDK, secrets, deployment, signing or authorization.
// A host's own reported values are never provider identity or free-billing proof.
const GiB=1024**3;
const MAX_AGE_MS=15*60*1000;
const CLOCK_SKEW_MS=30*1000;
const DEFAULT_ARCH="unsupported";
const ALLOWED_DOCKER_SECURITY=new Set([
  "name=rootless","name=cgroupns","name=selinux",
  "name=apparmor","name=seccomp,profile=default",
]);

function observedArch(value){
  return value==="aarch64"||value==="arm64"?"arm64":DEFAULT_ARCH;
}
function check(id,passed){
  return Object.freeze({id,passed:passed===true});
}
export function assessOciA1Host(evidence,{now=Date.now()}={}){
  const e=evidence!==null&&typeof evidence==="object"&&!Array.isArray(evidence)?evidence:{};
  const arch=observedArch(e.architecture);
  const uid=e.userUid;
  const osOk=e.osId==="ubuntu"&&e.osVersion==="24.04";
  const capacityOk=Number.isSafeInteger(e.logicalCpus)&&e.logicalCpus>=2
    &&Number.isSafeInteger(e.memoryBytes)&&e.memoryBytes>=10*GiB
    &&Number.isSafeInteger(e.availableDiskBytes)&&e.availableDiskBytes>=16*GiB;
  const uidOk=Number.isSafeInteger(uid)&&uid>=1000&&uid<=65535;
  const socketOk=uidOk&&e.dockerSocket==="/run/user/"+uid+"/docker.sock"
    &&e.dockerSocketType==="socket"&&e.dockerSocketOwnerUid===uid;
  const opts=e.dockerSecurityOptions;
  const rootless=Array.isArray(opts)&&opts.length>=1&&opts.length<=8
    &&opts.includes("name=rootless")
    &&opts.every(v=>typeof v==="string"&&ALLOWED_DOCKER_SECURITY.has(v));
  const fresh=Number.isSafeInteger(now)&&Number.isSafeInteger(e.observedAt)
    &&e.observedAt>=now-MAX_AGE_MS&&e.observedAt<=now+CLOCK_SKEW_MS;
  const controls=Object.freeze([
    check("ubuntu_24_04_image",osOk),
    check("arm64_compute_architecture",arch==="arm64"),
    check("minimum_local_resources_observed",capacityOk),
    check("non_root_owning_uid_observed",uidOk),
    check("exact_own_uid_unix_socket_observed",socketOk),
    check("rootless_docker_security_observed",rootless),
    check("local_observation_fresh",fresh),
  ]);
  const passed=controls.every(x=>x.passed);
  // No provider OCID, invoice, host identity or rootless Daemon installation
  // can be trusted from caller-owned metadata. Only a separately authorized
  // provider and host-operator attestation can promote this observation.
  return Object.freeze({
    schema:"hercules.cloud.oci-a1-host-local-readiness.v1",
    expectedProvider:"oracle_cloud_infrastructure",
    expectedHostFamily:"VM.Standard.A1.Flex",
    observedArchitecture:arch,
    localTechnicalPreflightPassed:passed,
    controls,
    providerIdentityVerified:false,
    serverOwnedByUserVerified:false,
    incrementalMonthlyCostVerified:false,
    registeredHostVerified:false,
    hostRegistered:false,
    executionAuthorized:false,
    productionAuthorized:false,
    publicReleaseApproved:false,
    nextStage:passed
      ?"independent_provider_and_owner_attestation"
      :"collect_verified_local_host_observations",
  });
}
