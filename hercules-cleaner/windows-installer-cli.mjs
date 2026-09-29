#!/usr/bin/env node
import {readFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {
  installWindowsCleaner,
  rollbackWindowsCleaner,
  uninstallWindowsCleaner,
  verifyWindowsInstallIdentity,
  verifyWindowsPackageFiles,
} from "./windows-installer.mjs";

function option(args,flag,fallback){
  const index=args.indexOf(flag);
  return index>=0&&args[index+1]?args[index+1]:fallback;
}

function requireSupportedNode(){
  const major=Number(process.versions.node.split(".")[0]);
  if(!Number.isInteger(major)||major<22)throw new Error("Node.js 22 or newer is required");
}

async function readPackageManifest(sourceRoot){
  const path=resolve(sourceRoot,"cleaner-release-manifest.json");
  const manifest=JSON.parse(await readFile(path,"utf8"));
  const candidate={
    version:manifest.version,
    commitSha:manifest.sourceCommit,
    aggregateSha256:manifest.aggregateSha256,
    releaseClass:manifest.releaseClass,
    checkoutEnabled:manifest.checkoutEnabled,
    files:manifest.files,
  };
  const expected={
    commitSha:manifest.sourceCommit,
    aggregateSha256:manifest.aggregateSha256,
  };
  const identity=verifyWindowsInstallIdentity({candidate,expected});
  if(!identity.allowed)throw new Error(identity.reason);
  const files=await verifyWindowsPackageFiles({sourceRoot,manifest});
  if(!files.allowed)throw new Error(files.reason+(files.path?":"+files.path:""));
  return {candidate,expected};
}

async function main(){
  requireSupportedNode();
  if(process.platform!=="win32")throw new Error("Hercules Cleaner Windows setup must be run on Windows");

  const args=process.argv.slice(2);
  const action=(args[0]&&!args[0].startsWith("--")?args.shift():"install").toLowerCase();
  const defaultRoot=resolve(dirname(fileURLToPath(import.meta.url)),"..");
  const sourceRoot=resolve(option(args,"--source",defaultRoot));

  let result;
  if(action==="install"||action==="update"){
    const {candidate,expected}=await readPackageManifest(sourceRoot);
    result=await installWindowsCleaner({sourceRoot,candidate,expected});
  }else if(action==="rollback"){
    result=await rollbackWindowsCleaner();
  }else if(action==="uninstall"){
    result=await uninstallWindowsCleaner();
  }else{
    throw new Error("Usage: HerculesCleaner-Setup.cmd [install|update|rollback|uninstall]");
  }

  process.stdout.write(JSON.stringify({ok:true,action,...result},null,2)+"\n");
}

main().catch(error=>{
  process.stderr.write("Hercules Cleaner setup: "+(error instanceof Error?error.message:String(error))+"\n");
  process.exitCode=1;
});
