import {existsSync} from "node:fs";
import {readFile,writeFile,mkdir,readdir} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import {spawnSync} from "node:child_process";

const root=new URL("../staging-plane/",import.meta.url);
const envFile=new URL(".env",root);
const compose=["compose","--env-file",envFile.pathname,"-f",new URL("compose.yml",root).pathname];

function docker(args,options={}){
  const result=spawnSync("docker",[...compose,...args],{stdio:"inherit",...options});
  if(result.error?.code==="ENOENT")throw new Error("docker_is_required_on_the_target_host");
  if(result.status!==0)throw new Error(`docker_compose_failed:${args.join("_")}`);
}

function dockerCapture(args,input){
  const result=spawnSync("docker",[...compose,...args],{input,stdio:[input?"pipe":"ignore","pipe","inherit"]});
  if(result.error?.code==="ENOENT")throw new Error("docker_is_required_on_the_target_host");
  if(result.status!==0)throw new Error(`docker_compose_failed:${args.join("_")}`);
  return result.stdout;
}

async function ensureEnv(){
  const secret=()=>randomBytes(32).toString("hex");
  let text=existsSync(envFile)?await readFile(envFile,"utf8"):"";
  const present=new Set(
    text.split(/\r?\n/).map(line=>line.slice(0,line.indexOf("="))).filter(Boolean),
  );
  const required=[
    "HERCULES_STAGING_DB_PASSWORD",
    "HERCULES_STAGING_API_PASSWORD",
    "HERCULES_STAGING_JWT_SECRET",
    "HERCULES_FORGE_STAGING_CONTROL_TOKEN",
  ];
  let changed=!existsSync(envFile);
  for(const name of required){
    if(present.has(name))continue;
    if(text && !text.endsWith("\n"))text+="\n";
    text+=name+"="+secret()+"\n";
    changed=true;
  }
  if(changed)await writeFile(envFile,text,{mode:0o600});
}

async function action(name){
  if(name!=="validate")await ensureEnv();
  if(name==="up")docker(["up","-d","--wait"]);
  else if(name==="down")docker(["down","--volumes","--remove-orphans"]);
  else if(name==="verify")docker(["exec","-T","postgres","psql","-v","ON_ERROR_STOP=1","-U","hercules_admin","-d","hercules_staging","-f","/staging-bin/verify.sql"]);
  else if(name==="backup"){
    const directory=new URL("backups/",root);
    await mkdir(directory,{recursive:true});
    const stamp=new Date().toISOString().replaceAll(":","-").replaceAll(".","-");
    const dump=dockerCapture(["exec","-T","postgres","pg_dump","--format=custom","--no-owner","--no-acl","-U","hercules_admin","hercules_staging"]);
    const file=new URL(`hercules-staging-${stamp}.dump`,directory);
    await writeFile(file,dump,{mode:0o600});
    console.log(file.pathname);
  }else if(name==="restore-test"){
    const directory=new URL("backups/",root);
    const backups=(await readdir(directory)).filter(file=>file.endsWith(".dump")).sort();
    if(!backups.length)throw new Error("staging_backup_required");
    const dump=await readFile(new URL(backups.at(-1),directory));
    docker(["exec","-T","postgres","dropdb","--if-exists","-U","hercules_admin","hercules_restore_test"]);
    docker(["exec","-T","postgres","createdb","-U","hercules_admin","hercules_restore_test"]);
    try{
      dockerCapture(["exec","-T","postgres","pg_restore","--no-owner","--no-acl","-U","hercules_admin","-d","hercules_restore_test"],dump);
      docker(["exec","-T","postgres","psql","-v","ON_ERROR_STOP=1","-U","hercules_admin","-d","hercules_restore_test","-f","/staging-bin/verify.sql"]);
    }finally{
      docker(["exec","-T","postgres","dropdb","--if-exists","-U","hercules_admin","hercules_restore_test"]);
    }
  }else if(name==="benchmark"){
    const result=spawnSync(process.execPath,[new URL("performance-harness.mjs",import.meta.url).pathname,"--profile","load","--base-url","http://127.0.0.1:38080","--confirm-fixture","--output","benchmarks/performance/staging-load.json"],{stdio:"inherit"});
    if(result.status!==0)throw new Error("staging_benchmark_failed");
  }else if(name==="all"){
    docker(["up","-d","--wait"]);
    await action("verify");
    await action("benchmark");
    await action("backup");
    await action("restore-test");
  }else throw new Error("usage: npm run hercules:staging -- up|down|verify|backup|restore-test|benchmark|all");
}

await action(process.argv[2]||"").catch(error=>{console.error(error.message);process.exitCode=1;});
