import {createHash} from "node:crypto";
import {cp, mkdir, readdir, readFile, rm, writeFile} from "node:fs/promises";
import {join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=fileURLToPath(new URL("../",import.meta.url));
const VERSION="1.0.0";
const ROOT_SCRIPTS=Object.freeze([
  "install.cmd",
  "Install-HerculesCleaner.ps1",
  "Launch-HerculesCleaner.ps1",
  "Update-HerculesCleaner.ps1",
  "Uninstall-HerculesCleaner.ps1",
  "HerculesCleaner.cmd",
]);

function sha256(bytes){return createHash("sha256").update(bytes).digest("hex")}

function resolvedCommit(value){
  const sha=String(value||"").trim().toLowerCase();
  if(!/^[a-f0-9]{40}$/.test(sha))throw new Error("resolved 40-character commit SHA required");
  return sha;
}

async function walk(root,current=root,out=[]){
  const entries=await readdir(current,{withFileTypes:true});
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
    const full=join(current,entry.name);
    if(entry.isDirectory())await walk(root,full,out);
    else if(entry.isFile())out.push(relative(root,full).replaceAll("\\","/"));
  }
  return out;
}

export async function buildWindowsInstallerBundle({commitSha,outputDir}={}){
  const sourceCommit=resolvedCommit(commitSha);
  const destination=resolve(outputDir);
  await rm(destination,{recursive:true,force:true});
  await mkdir(destination,{recursive:true});

  const appRoot=join(destination,"app");
  await mkdir(appRoot,{recursive:true});
  await cp(join(ROOT,"hercules-cleaner"),join(appRoot,"hercules-cleaner"),{recursive:true});
  await mkdir(join(appRoot,"docs"),{recursive:true});
  await cp(join(ROOT,"docs","HERCULES-CLEANER-V1.md"),join(appRoot,"docs","HERCULES-CLEANER-V1.md"));
  await cp(join(ROOT,"docs","HERCULES-THREAT-MODEL.md"),join(appRoot,"docs","HERCULES-THREAT-MODEL.md"));
  await cp(join(ROOT,"SECURITY.md"),join(appRoot,"SECURITY.md"));
  await cp(join(ROOT,"LICENSE"),join(appRoot,"LICENSE"));

  for(const name of ROOT_SCRIPTS){
    await cp(join(ROOT,"hercules-cleaner","windows",name),join(destination,name));
  }
  await mkdir(join(destination,"update"),{recursive:true});
  await cp(
    join(ROOT,"releases","hercules-cleaner-v1.0.0","windows","update-channel.json"),
    join(destination,"update","update-channel.json")
  );

  const files=(await walk(destination)).filter(path=>path!=="bundle-manifest.json");
  const fileRows=[];
  for(const path of files){
    const bytes=await readFile(join(destination,path));
    fileRows.push(Object.freeze({path,bytes:bytes.length,sha256:sha256(bytes)}));
  }
  const aggregateSha256=sha256(Buffer.from(fileRows.map(x=>x.path+":"+x.sha256).join("\n"),"utf8"));
  const manifest={
    schema:"sauceapproved.hercules-cleaner.windows-bundle",
    version:VERSION,
    releaseClass:"early_access",
    product:"Hercules Cleaner",
    sourceCommit,
    minimumNodeMajor:22,
    installMode:"per_user",
    installRoot:"%LOCALAPPDATA%\\SauceApproved\\Hercules Cleaner",
    stateRoot:"%USERPROFILE%\\.hercules-cleaner",
    userDataPreservedAcrossUpdates:true,
    autoUpdate:{
      supported:true,
      channel:"early_access",
      manifestUrl:"https://raw.githubusercontent.com/Sauceapproved7/expert-doodle/main/releases/hercules-cleaner-v1.0.0/windows/update-channel.json",
      enabledAtBuild:false,
      trustedExpectedIdentityRequired:true,
      integrity:"sha256+exact-source-commit+health-check+rollback-receipt"
    },
    publisherSigning:{
      authenticodeSigned:false,
      stableReleaseAllowed:false,
      status:"signature_ready_owner_certificate_required",
      note:"GitHub artifact attestation is build provenance, not Windows Authenticode publisher signing."
    },
    externalRuntime:{nodejsBundled:false,minimumMajor:22},
    files:fileRows,
    aggregateSha256
  };
  await writeFile(join(destination,"bundle-manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  return {destination,manifest,aggregateSha256};
}

function parse(argv){
  const out={commitSha:process.env.GITHUB_SHA||"",outputDir:"/tmp/hercules-cleaner-windows-v1.0.0"};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==="--commit-sha")out.commitSha=argv[++i];
    else if(argv[i]==="--output-dir")out.outputDir=argv[++i];
    else throw new Error("unknown_argument:"+argv[i]);
  }
  return out;
}

async function main(){
  const result=await buildWindowsInstallerBundle(parse(process.argv.slice(2)));
  process.stdout.write(JSON.stringify({
    ok:true,destination:result.destination,version:result.manifest.version,
    sourceCommit:result.manifest.sourceCommit,aggregateSha256:result.aggregateSha256,
    files:result.manifest.files.length,authenticodeSigned:result.manifest.publisherSigning.authenticodeSigned
  },null,2)+"\n");
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
}
