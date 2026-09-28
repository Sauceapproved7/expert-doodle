function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value ?? ""));
  if (!match) return null;
  return match.slice(1).map(Number);
}

function compareVersion(a, b) {
  const left=parseVersion(a), right=parseVersion(b);
  if (!left || !right) return null;
  for (let i=0;i<3;i+=1) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }
  return 0;
}

export function evaluateCleanerUpdate({currentVersion,candidate,expected}={}) {
  if (!candidate || !expected) return {allowed:false,reason:"missing-update-identity"};
  if (!/^[a-f0-9]{40}$/.test(String(candidate.commitSha ?? ""))) {
    return {allowed:false,reason:"invalid-commit-identity"};
  }
  if (!/^[a-f0-9]{64}$/.test(String(candidate.aggregateSha256 ?? ""))) {
    return {allowed:false,reason:"invalid-package-digest"};
  }
  if (candidate.commitSha !== expected.commitSha || candidate.aggregateSha256 !== expected.aggregateSha256) {
    return {allowed:false,reason:"update-identity-mismatch"};
  }
  if (candidate.checkoutEnabled !== false || candidate.releaseClass !== "early_access") {
    return {allowed:false,reason:"commercial-gate-mismatch"};
  }
  const order=compareVersion(candidate.version,currentVersion);
  if (order === null) return {allowed:false,reason:"invalid-version"};
  if (order <= 0) return {allowed:false,reason:"version-not-newer"};
  return {allowed:true,reason:"verified-update",rollbackVersion:String(currentVersion)};
}
