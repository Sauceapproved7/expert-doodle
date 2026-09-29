import {execFile} from "node:child_process";
import {randomUUID} from "node:crypto";
import {mkdir, readFile, rename, stat, writeFile} from "node:fs/promises";
import {homedir, platform as currentPlatform} from "node:os";
import path, {dirname, join, resolve} from "node:path";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import {evaluateCleanerUpdate} from "./update-policy.mjs";

const execFileAsync=promisify(execFile);
const UPDATE_HOSTS=new Set(["github.com","objects.githubusercontent.com","raw.githubusercontent.com"]);

function strictSemver(value){
  const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(value||""));
  if(!match)throw new Error("valid semantic version x.y.z required");
  return match.slice(1).map(Number);
}

export function compareVersions(a,b){
  const left=strictSemver(a),right=strictSemver(b);
  for(let i=0;i<3;i++){
    if(left[i]<right[i])return -1;
    if(left[i]>right[i])return 1;
  }
  return 0;
}

export function createInstallLayout({
  platform=currentPlatform(),
  home=homedir(),
  localAppData=process.env.LOCALAPPDATA,
  version,
}={}){
  strictSemver(version);
  if(platform==="win32"){
    const base=localAppData||path.win32.join(home,"AppData","Local");
    const installRoot=path.win32.join(base,"SauceApproved","Hercules Cleaner");
    return {
      platform,
      installRoot,
      versionsRoot:path.win32.join(installRoot,"versions"),
      versionRoot:path.win32.join(installRoot,"versions",version),
      activeFile:path.win32.join(installRoot,"active.json"),
      receiptsRoot:path.win32.join(installRoot,"update-receipts"),
      stateRoot:path.win32.join(home,".hercules-cleaner"),
    };
  }
  const installRoot=resolve(home,".local","share","sauceapproved","hercules-cleaner");
  return {
    platform,
    installRoot,
    versionsRoot:join(installRoot,"versions"),
    versionRoot:join(installRoot,"versions",version),
    activeFile:join(installRoot,"active.json"),
    receiptsRoot:join(installRoot,"update-receipts"),
    stateRoot:resolve(home,".hercules-cleaner"),
  };
}

function httpsUrl(value){
  let url;
  try{url=new URL(String(value||""))}catch{throw new Error("valid HTTPS update artifact URL required")}
  if(url.protocol!=="https:")throw new Error("update artifact URL must use HTTPS");
  if(!UPDATE_HOSTS.has(url.hostname.toLowerCase()))throw new Error("update artifact host is not allowed");
  return url.toString();
}

export function validateUpdateChannel(channel){
  if(channel?.schema!=="sauceapproved.hercules-cleaner.update-channel")throw new Error("invalid Hercules Cleaner update-channel schema");
  if(channel?.channel!=="early_access"&&channel?.channel!=="stable")throw new Error("invalid update channel");
  strictSemver(channel.version);
  if(!Number.isInteger(Number(channel.minimumNodeMajor))||Number(channel.minimumNodeMajor)<22)throw new Error("minimum Node.js major must be at least 22");
  const enabled=channel.enabled===true;
  if(!enabled)return {...channel,enabled:false};
  if(channel.releaseClass!=="early_access"||channel.checkoutEnabled!==false)throw new Error("commercial update gate mismatch");
  if(!/^[a-f0-9]{40}$/i.test(String(channel.sourceCommit||"")))throw new Error("resolved 40-character source commit required");
  if(!/^[a-f0-9]{64}$/i.test(String(channel.artifactSha256||"")))throw new Error("valid artifact SHA-256 required");
  return {...channel,enabled:true,artifactUrl:httpsUrl(channel.artifactUrl)};
}

export function buildUpdateDecision({currentVersion,channel,expected}){
  strictSemver(currentVersion);
  const checked=validateUpdateChannel(channel);
  if(!checked.enabled)return {action:"hold",reason:"channel-disabled"};
  if(!expected?.commitSha||!expected?.aggregateSha256){
    return {action:"hold",reason:"expected-update-identity-required"};
  }
  const policy=evaluateCleanerUpdate({
    currentVersion,
    candidate:{
      version:checked.version,
      commitSha:String(checked.sourceCommit).toLowerCase(),
      aggregateSha256:String(checked.artifactSha256).toLowerCase(),
      releaseClass:checked.releaseClass,
      checkoutEnabled:checked.checkoutEnabled,
    },
    expected:{
      commitSha:String(expected.commitSha).toLowerCase(),
      aggregateSha256:String(expected.aggregateSha256).toLowerCase(),
    },
  });
  if(!policy.allowed)return {action:"hold",reason:policy.reason};
  return {
    action:"update",
    reason:policy.reason,
    rollbackVersion:policy.rollbackVersion,
    version:checked.version,
    sourceCommit:String(checked.sourceCommit).toLowerCase(),
    artifactUrl:checked.artifactUrl,
    artifactSha256:String(checked.artifactSha256).toLowerCase(),
    minimumNodeMajor:Number(checked.minimumNodeMajor),
  };
}

export function validateArchiveEntries(entries){
  if(!Array.isArray(entries)||entries.length<1)throw new Error("archive entry list required");
  return entries.map(raw=>{
    const original=String(raw||"").trim();
    const normalized=original.replaceAll("\\","/");
    const segments=normalized.split("/");
    const unsafe=!normalized ||
      normalized.startsWith("/") ||
      /^[a-zA-Z]:\//.test(normalized) ||
      segments.includes("..") ||
      segments.some(segment=>segment===".");
    if(unsafe)throw new Error(`unsafe archive entry: ${original||"<empty>"}`);
    return original;
  });
}

async function readJson(pathname){
  try{return JSON.parse(await readFile(pathname,"utf8"))}
  catch(error){if(error?.code==="ENOENT")return null;throw error}
}

async function atomicJson(pathname,value){
  await mkdir(dirname(pathname),{recursive:true});
  const temp=`${pathname}.${randomUUID()}.tmp`;
  await writeFile(temp,JSON.stringify(value,null,2)+"\n",{mode:0o600});
  await rename(temp,pathname);
}

function receiptName(date){
  return date.toISOString().replace(/[:.]/g,"-")+".json";
}

export async function activateInstalledVersion({
  installRoot,
  version,
  sourceCommit=null,
  artifactSha256=null,
  healthCheck,
  now=()=>new Date(),
}){
  strictSemver(version);
  const root=resolve(installRoot);
  const target=join(root,"versions",version);
  const targetStat=await stat(target).catch(()=>null);
  if(!targetStat?.isDirectory())throw new Error("staged Hercules Cleaner version directory is missing");
  if(typeof healthCheck!=="function")throw new Error("health check is required before activation");

  const activePath=join(root,"active.json");
  const previous=await readJson(activePath);
  const date=now();
  const receiptPath=join(root,"update-receipts",receiptName(date));
  await mkdir(dirname(receiptPath),{recursive:true});

  let health;
  try{health=await healthCheck({versionRoot:target,version})}
  catch(error){health={ok:false,error:error instanceof Error?error.message:String(error)}}

  if(health?.ok!==true){
    const error=String(health?.error||"Hercules Cleaner health check failed");
    await atomicJson(receiptPath,{
      schema:"sauceapproved.hercules-cleaner.update-receipt",
      status:"rolled_back",
      previousVersion:previous?.version||null,
      attemptedVersion:version,
      sourceCommit,
      artifactSha256,
      health,
      recordedAt:date.toISOString(),
    });
    throw new Error(error);
  }

  const next={
    schema:"sauceapproved.hercules-cleaner.active-install",
    version,
    versionRoot:target,
    sourceCommit:/^[a-f0-9]{40}$/i.test(String(sourceCommit||""))?String(sourceCommit).toLowerCase():null,
    artifactSha256:/^[a-f0-9]{64}$/i.test(String(artifactSha256||""))?String(artifactSha256).toLowerCase():null,
    activatedAt:date.toISOString(),
  };
  await atomicJson(activePath,next);
  const receipt={
    schema:"sauceapproved.hercules-cleaner.update-receipt",
    status:"activated",
    previousVersion:previous?.version||null,
    attemptedVersion:version,
    sourceCommit:next.sourceCommit,
    artifactSha256:next.artifactSha256,
    health,
    recordedAt:date.toISOString(),
  };
  await atomicJson(receiptPath,receipt);
  return {...receipt,active:next};
}

async function cliHealthCheck({versionRoot,nodePath=process.execPath,stateRoot}){
  const cli=join(versionRoot,"hercules-cleaner","cli.mjs");
  try{
    const {stdout}=await execFileAsync(nodePath,[cli,"status"],{
      windowsHide:true,
      timeout:20_000,
      env:{...process.env,...(stateRoot?{HERCULES_CLEANER_STATE_ROOT:stateRoot}:{})},
    });
    const status=JSON.parse(stdout);
    return {ok:Boolean(status&&typeof status==="object"),command:"status"};
  }catch(error){
    return {ok:false,error:error instanceof Error?error.message:String(error)};
  }
}

function args(argv){
  const out={command:argv[0]||"",values:{}};
  for(let i=1;i<argv.length;i++){
    const item=argv[i];
    if(item.startsWith("--")){
      const next=argv[i+1];
      out.values[item.slice(2)]=next&&!next.startsWith("--")?argv[++i]:true;
    }
  }
  return out;
}

async function main(){
  const parsed=args(process.argv.slice(2));
  if(parsed.command==="validate-archive"){
    const list=String(parsed.values["list-file"]||"");
    const entries=(await readFile(list,"utf8")).split(/\r?\n/).filter(Boolean);
    process.stdout.write(JSON.stringify({ok:true,entries:validateArchiveEntries(entries).length})+"\n");
    return;
  }
  if(parsed.command==="decision"){
    const current=String(parsed.values.current||"");
    const manifest=JSON.parse(await readFile(String(parsed.values.manifest||""),"utf8"));
    const expectedPath=String(parsed.values["expected-manifest"]||"");
    const expected=expectedPath?JSON.parse(await readFile(expectedPath,"utf8")):null;
    process.stdout.write(JSON.stringify(buildUpdateDecision({currentVersion:current,channel:manifest,expected}))+"\n");
    return;
  }
  if(parsed.command==="activate"){
    const installRoot=String(parsed.values["install-root"]||"");
    const version=String(parsed.values.version||"");
    const nodePath=String(parsed.values.node||process.execPath);
    const stateRoot=String(parsed.values["state-root"]||"")||undefined;
    const result=await activateInstalledVersion({
      installRoot,version,
      sourceCommit:String(parsed.values["source-commit"]||"")||null,
      artifactSha256:String(parsed.values["artifact-sha256"]||"")||null,
      healthCheck:({versionRoot})=>cliHealthCheck({versionRoot,nodePath,stateRoot}),
    });
    process.stdout.write(JSON.stringify(result)+"\n");
    return;
  }
  throw new Error("installer command required");
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  main().catch(error=>{
    process.stderr.write(`Hercules Cleaner installer: ${error instanceof Error?error.message:String(error)}\n`);
    process.exitCode=1;
  });
}
