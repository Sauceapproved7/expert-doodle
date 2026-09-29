import {createHash} from "node:crypto";
import {access, cp, mkdir, readFile, rm, stat, writeFile} from "node:fs/promises";
import {homedir, platform as currentPlatform} from "node:os";
import {join, resolve, win32} from "node:path";
import {evaluateCleanerUpdate} from "./update-policy.mjs";
import {uninstallAutostart} from "./autostart.mjs";

function sha256(bytes){return createHash("sha256").update(bytes).digest("hex")}

function validVersion(value){return /^\d+\.\d+\.\d+$/.test(String(value??""))}

function windowsBase(localAppData){
  if(!localAppData)throw new Error("LOCALAPPDATA is required for Windows install");
  return win32.join(localAppData,"SauceApproved","Hercules Cleaner");
}

function windowsStateRoot(home){
  if(!home)throw new Error("home directory is required");
  return win32.join(home,".hercules-cleaner");
}

function launcher(nodePath,cliPath){
  return `@echo off\r\n"${nodePath}" "${cliPath}" %*\r\n`;
}

export function verifyWindowsInstallIdentity({candidate,expected}={}){
  if(!candidate||!expected)return {allowed:false,reason:"missing-install-identity"};
  if(!validVersion(candidate.version))return {allowed:false,reason:"invalid-version"};
  if(!/^[a-f0-9]{40}$/i.test(String(candidate.commitSha??"")))return {allowed:false,reason:"invalid-commit-identity"};
  if(!/^[a-f0-9]{64}$/i.test(String(candidate.aggregateSha256??"")))return {allowed:false,reason:"invalid-package-digest"};
  if(candidate.commitSha.toLowerCase()!==String(expected.commitSha??"").toLowerCase()||
     candidate.aggregateSha256.toLowerCase()!==String(expected.aggregateSha256??"").toLowerCase()){
    return {allowed:false,reason:"install-identity-mismatch"};
  }
  if(candidate.releaseClass!=="early_access"||candidate.checkoutEnabled!==false){
    return {allowed:false,reason:"commercial-gate-mismatch"};
  }
  return {allowed:true,reason:"verified-install-identity"};
}

export async function verifyWindowsPackageFiles({sourceRoot,manifest}={}){
  if(!sourceRoot||!manifest||!Array.isArray(manifest.files)||!/^[a-f0-9]{64}$/i.test(String(manifest.aggregateSha256??""))){
    return {allowed:false,reason:"invalid-package-manifest"};
  }
  const hashes=[];
  for(const item of manifest.files){
    if(!item||typeof item.path!=="string"||!/^[a-f0-9]{64}$/i.test(String(item.sha256??""))){
      return {allowed:false,reason:"invalid-file-manifest"};
    }
    const target=join(resolve(sourceRoot),...item.path.split("/"));
    let bytes;
    try{bytes=await readFile(target)}catch{return {allowed:false,reason:"package-file-missing",path:item.path}}
    if(Number(item.bytes)!==bytes.length||sha256(bytes)!==String(item.sha256).toLowerCase()){
      return {allowed:false,reason:"file-integrity-mismatch",path:item.path};
    }
    hashes.push(item.path+":"+String(item.sha256).toLowerCase());
  }
  const aggregate=sha256(Buffer.from(hashes.join("\n"),"utf8"));
  if(aggregate!==String(manifest.aggregateSha256).toLowerCase()){
    return {allowed:false,reason:"aggregate-integrity-mismatch"};
  }
  return {allowed:true,reason:"verified-package-files"};
}

export function planWindowsInstall({
  localAppData,
  home,
  version,
  nodePath=process.execPath,
  sourceRoot,
}={}){
  if(!validVersion(version))throw new Error("valid semantic version required");
  const baseRoot=windowsBase(localAppData);
  const installRoot=win32.join(baseRoot,"app",version);
  const binPath=win32.join(baseRoot,"bin");
  const cliPath=win32.join(installRoot,"hercules-cleaner","cli.mjs");
  return Object.freeze({
    platform:"win32",
    scope:"user",
    requiresElevation:false,
    preserveState:true,
    baseRoot,
    installRoot,
    binPath,
    metadataPath:win32.join(baseRoot,"install-state.json"),
    launcherPath:win32.join(binPath,"HerculesCleaner.cmd"),
    launcherContent:launcher(resolve(nodePath),cliPath),
    cliPath,
    copySource:sourceRoot,
    stateRoot:windowsStateRoot(home),
  });
}

export function planWindowsUninstall({localAppData,home,version}={}){
  const baseRoot=windowsBase(localAppData);
  const remove=[
    win32.join(baseRoot,"bin"),
    validVersion(version)?win32.join(baseRoot,"app",version):win32.join(baseRoot,"app"),
    win32.join(baseRoot,"install-state.json"),
  ];
  return Object.freeze({
    platform:"win32",
    scope:"user",
    requiresElevation:false,
    preserveState:true,
    stateRoot:windowsStateRoot(home),
    baseRoot,
    remove:Object.freeze(remove),
  });
}

export function planWindowsRollback({localAppData,home,currentVersion,rollbackVersion,nodePath=process.execPath}={}){
  if(!validVersion(currentVersion)||!validVersion(rollbackVersion))throw new Error("current and rollback versions are required");
  const baseRoot=windowsBase(localAppData);
  const rollbackRoot=win32.join(baseRoot,"app",rollbackVersion);
  const currentRoot=win32.join(baseRoot,"app",currentVersion);
  const cliPath=win32.join(rollbackRoot,"hercules-cleaner","cli.mjs");
  return Object.freeze({
    platform:"win32",
    scope:"user",
    requiresElevation:false,
    preserveState:true,
    stateRoot:windowsStateRoot(home),
    baseRoot,
    currentRoot,
    rollbackRoot,
    launcherPath:win32.join(baseRoot,"bin","HerculesCleaner.cmd"),
    launcherContent:launcher(resolve(nodePath),cliPath),
  });
}

export function nextWindowsInstallState({previous,candidate,expected,stateRoot,installedAt=new Date().toISOString()}={}){
  if(previous){
    const result=evaluateCleanerUpdate({currentVersion:previous.currentVersion,candidate,expected});
    if(!result.allowed)return result;
    return {
      allowed:true,
      reason:"verified-update",
      state:Object.freeze({
        schema:"sauceapproved.hercules-cleaner.windows-install.v1",
        currentVersion:candidate.version,
        currentCommitSha:candidate.commitSha,
        currentAggregateSha256:candidate.aggregateSha256,
        rollbackVersion:previous.currentVersion,
        rollbackCommitSha:previous.currentCommitSha??null,
        rollbackAggregateSha256:previous.currentAggregateSha256??null,
        stateRoot:previous.stateRoot??stateRoot??null,
        installedAt,
      }),
    };
  }
  const result=verifyWindowsInstallIdentity({candidate,expected});
  if(!result.allowed)return result;
  return {
    allowed:true,
    reason:"verified-install",
    state:Object.freeze({
      schema:"sauceapproved.hercules-cleaner.windows-install.v1",
      currentVersion:candidate.version,
      currentCommitSha:candidate.commitSha,
      currentAggregateSha256:candidate.aggregateSha256,
      rollbackVersion:null,
      rollbackCommitSha:null,
      rollbackAggregateSha256:null,
      stateRoot:stateRoot??null,
      installedAt,
    }),
  };
}

async function readInstallState(metadataPath){
  try{return JSON.parse(await readFile(metadataPath,"utf8"))}
  catch(error){if(error&&error.code==="ENOENT")return null;throw error}
}

async function assertMissing(path){
  try{await access(path);throw new Error("install-root-exists")}
  catch(error){if(error?.message==="install-root-exists")throw error;if(error?.code!=="ENOENT")throw error}
}

export async function installWindowsCleaner({
  localAppData=process.env.LOCALAPPDATA,
  home=homedir(),
  nodePath=process.execPath,
  sourceRoot,
  candidate,
  expected,
  now=new Date().toISOString(),
  platform=currentPlatform(),
}={}){
  if(platform!=="win32")throw new Error("windows installer can run only on Windows");
  const plan=planWindowsInstall({localAppData,home,version:candidate?.version,nodePath,sourceRoot});
  const packageResult=await verifyWindowsPackageFiles({sourceRoot,manifest:{...candidate,files:candidate?.files}});
  if(!packageResult.allowed)throw new Error(packageResult.reason);
  const previous=await readInstallState(plan.metadataPath);
  const transition=nextWindowsInstallState({previous,candidate,expected,stateRoot:plan.stateRoot,installedAt:now});
  if(!transition.allowed)throw new Error(transition.reason);
  await assertMissing(plan.installRoot);
  await mkdir(win32.dirname(plan.installRoot),{recursive:true});
  await cp(sourceRoot,plan.installRoot,{recursive:true,errorOnExist:true,force:false});
  await mkdir(plan.binPath,{recursive:true});
  await writeFile(plan.launcherPath,plan.launcherContent,{mode:0o700});
  await writeFile(plan.metadataPath,JSON.stringify(transition.state,null,2)+"\n",{mode:0o600});
  return {installed:true,updated:Boolean(previous),plan,state:transition.state};
}

export async function rollbackWindowsCleaner({
  localAppData=process.env.LOCALAPPDATA,
  home=homedir(),
  nodePath=process.execPath,
  platform=currentPlatform(),
  now=new Date().toISOString(),
}={}){
  if(platform!=="win32")throw new Error("windows rollback can run only on Windows");
  const baseRoot=windowsBase(localAppData);
  const metadataPath=win32.join(baseRoot,"install-state.json");
  const previous=await readInstallState(metadataPath);
  if(!previous?.rollbackVersion)throw new Error("rollback-version-unavailable");
  const plan=planWindowsRollback({localAppData,home,currentVersion:previous.currentVersion,rollbackVersion:previous.rollbackVersion,nodePath});
  try{const info=await stat(plan.rollbackRoot);if(!info.isDirectory())throw new Error("rollback-version-missing")}
  catch(error){if(error?.message==="rollback-version-missing")throw error;throw new Error("rollback-version-missing")}
  await mkdir(win32.dirname(plan.launcherPath),{recursive:true});
  await writeFile(plan.launcherPath,plan.launcherContent,{mode:0o700});
  const state={
    ...previous,
    currentVersion:previous.rollbackVersion,
    currentCommitSha:previous.rollbackCommitSha,
    currentAggregateSha256:previous.rollbackAggregateSha256,
    rollbackVersion:previous.currentVersion,
    rollbackCommitSha:previous.currentCommitSha,
    rollbackAggregateSha256:previous.currentAggregateSha256,
    installedAt:now,
  };
  await writeFile(metadataPath,JSON.stringify(state,null,2)+"\n",{mode:0o600});
  return {rolledBack:true,plan,state};
}

export async function uninstallWindowsCleaner({
  localAppData=process.env.LOCALAPPDATA,
  home=homedir(),
  nodePath=process.execPath,
  platform=currentPlatform(),
}={}){
  if(platform!=="win32")throw new Error("windows uninstall can run only on Windows");
  const baseRoot=windowsBase(localAppData);
  const metadataPath=win32.join(baseRoot,"install-state.json");
  const previous=await readInstallState(metadataPath);
  const plan=planWindowsUninstall({localAppData,home,version:previous?.currentVersion});
  if(previous?.currentVersion){
    const cliPath=win32.join(baseRoot,"app",previous.currentVersion,"hercules-cleaner","cli.mjs");
    await uninstallAutostart({platform:"win32",home,nodePath,cliPath}).catch(()=>{});
  }
  await rm(baseRoot,{recursive:true,force:true});
  return {uninstalled:true,statePreserved:true,stateRoot:plan.stateRoot};
}
