import {createHash} from "node:crypto";
import {cp, mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=fileURLToPath(new URL("../",import.meta.url));
const VERSION="1.1.0";
const RELEASE_FILES=Object.freeze([
  "HerculesCleaner-Setup.cmd",
  "hercules-cleaner/agent.mjs",
  "hercules-cleaner/autostart.mjs",
  "hercules-cleaner/cli.mjs",
  "hercules-cleaner/dashboard.mjs",
  "hercules-cleaner/defaults.mjs",
  "hercules-cleaner/engine.mjs",
  "hercules-cleaner/scheduler.mjs",
  "hercules-cleaner/server.mjs",
  "hercules-cleaner/state.mjs",
  "hercules-cleaner/update-policy.mjs",
  "hercules-cleaner/windows-installer.mjs",
  "hercules-cleaner/windows-installer-cli.mjs",
  "tests/hercules-cleaner.test.mjs",
  "tests/hercules-cleaner-agent.test.mjs",
  "tests/hercules-cleaner-command.test.mjs",
  "tests/hercules-cleaner-update-policy.test.mjs",
  "tests/hercules-cleaner-windows-installer.test.mjs",
  "tests/hercules-cleaner-release-package.test.mjs",
  "docs/HERCULES-CLEANER-V1.md",
  "docs/HERCULES-THREAT-MODEL.md",
  "releases/hercules-cleaner-v1.1.0/README.md",
  "releases/hercules-cleaner-v1.1.0/INSTALL.md",
  "releases/hercules-cleaner-v1.1.0/SECURITY.md",
  "releases/hercules-cleaner-v1.1.0/RELEASE-NOTES.md",
  "releases/hercules-cleaner-v1.1.0/release-manifest.json",
  "LICENSE",
  "SECURITY.md",
]);

function sha256(bytes){return createHash("sha256").update(bytes).digest("hex")}

function resolvedCommitSha(value){
  const sha=String(value??"").trim();
  if(!/^[a-f0-9]{40}$/i.test(sha))throw new Error("resolved 40-character commit SHA required");
  return sha.toLowerCase();
}

export async function buildCleanerReleaseManifest({commitSha}={}){
  const sourceCommit=resolvedCommitSha(commitSha);
  const files=[];
  for(const path of RELEASE_FILES){
    const bytes=await readFile(join(ROOT,path));
    files.push(Object.freeze({path,bytes:bytes.length,sha256:sha256(bytes)}));
  }
  const aggregateSha256=sha256(Buffer.from(files.map(file=>file.path+":"+file.sha256).join("\n"),"utf8"));
  return Object.freeze({
    schema:"sauceapproved.hercules.cleaner.package.v1",
    product:"Hercules Cleaner",
    descriptor:"Recoverable Computer Maintenance",
    version:VERSION,
    releaseClass:"early_access",
    canonicalRepository:"Sauceapproved7/expert-doodle",
    sourceCommit,
    deliveryMode:"local_agent_with_verified_windows_setup",
    checkoutEnabled:false,
    pricingStatus:"owner_approval_required",
    supportedPlatforms:Object.freeze(["windows","macos","linux"]),
    windowsSetup:"HerculesCleaner-Setup.cmd",
    differentiators:Object.freeze(["session_clean","recovery_capsules"]),
    files:Object.freeze(files),
    aggregateSha256,
    nonClaims:Object.freeze([
      "Windows setup requires Node.js 22+; no third-party runtime is bundled.",
      "This release does not claim antivirus or malware-removal capability.",
      "This release does not perform registry optimization.",
      "This release does not bypass operating-system permissions or elevation controls.",
      "Updates require explicit user invocation; no silent auto-update is claimed.",
    ]),
  });
}

export async function writeCleanerReleasePackage({commitSha,outputDir}={}){
  const manifest=await buildCleanerReleaseManifest({commitSha});
  const destination=resolve(ROOT,outputDir);
  await mkdir(destination,{recursive:true});
  for(const item of manifest.files){
    const target=join(destination,item.path);
    await mkdir(dirname(target),{recursive:true});
    await cp(join(ROOT,item.path),target);
  }
  await writeFile(join(destination,"cleaner-release-manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  const trust=Object.freeze({
    schema:"sauceapproved.hercules.cleaner.release-trust.v1",
    version:manifest.version,
    sourceCommit:manifest.sourceCommit,
    aggregateSha256:manifest.aggregateSha256,
  });
  await writeFile(join(destination,"cleaner-release-trust.json"),JSON.stringify(trust,null,2)+"\n",{mode:0o600});
  return {destination,manifest,trust};
}

function parseArgs(argv){
  const out={commitSha:process.env.GITHUB_SHA||"",outputDir:"/tmp/hercules-cleaner-v1.1.0"};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==="--commit-sha")out.commitSha=argv[++i];
    else if(argv[i]==="--output-dir")out.outputDir=argv[++i];
    else throw new Error("unknown_argument:"+argv[i]);
  }
  return out;
}

async function main(){
  const result=await writeCleanerReleasePackage(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    ok:true,
    destination:result.destination,
    product:result.manifest.product,
    version:result.manifest.version,
    sourceCommit:result.manifest.sourceCommit,
    aggregateSha256:result.manifest.aggregateSha256,
    files:result.manifest.files.length,
  },null,2));
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
}
