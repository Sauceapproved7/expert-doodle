import {constants,closeSync,existsSync,fsyncSync,lstatSync,openSync,readFileSync,renameSync,unlinkSync,writeFileSync} from "node:fs";
import {basename,dirname,isAbsolute,join} from "node:path";
import {randomUUID} from "node:crypto";
import {createWorkEngine,WorkError} from "./free-work-core.mjs";

const SCHEMA="sauceapproved.hercules.free-work.file-state.v1";
const MAX_BYTES=8*1024*1024;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ALLOWED_KINDS=new Set(["plan","research","review","code"]);
const ALLOWED_STATES=new Set(["queued","running","completed","blocked"]);
const validText=(v,min,max)=>typeof v==="string"&&v.trim().length>=min&&Buffer.byteLength(v,"utf8")<=max;

function checkDirectory(dir) {
  let st;
  try{st=lstatSync(dir);}catch{throw new Error("private_directory_required");}
  if(!st.isDirectory()||(st.mode&0o077)!==0||
     (typeof process.getuid==="function"&&st.uid!==process.getuid()))
    throw new Error("private_directory_required");
}
function checkFile(path){
  if(!existsSync(path))return false;
  const st=lstatSync(path);
  if(st.isSymbolicLink())throw new Error("storage_symlink_denied");
  if(!st.isFile()||(st.mode&0o077)!==0||
     (typeof process.getuid==="function"&&st.uid!==process.getuid()))
    throw new Error("private_file_required");
  if(st.size>MAX_BYTES)throw new Error("storage_limit_exceeded");
  return true;
}
function validateStoredJob(job){
  if(!job||typeof job!=="object"||Array.isArray(job)||
    !UUID.test(job.id??"")||!ALLOWED_KINDS.has(job.kind)||
    !validText(job.prompt,1,8000)||!validText(job.context,0,16000)||
    !ALLOWED_STATES.has(job.status)||
    !(job.output===null||validText(job.output,0,30000))||
    !(job.engine===null||validText(job.engine,1,80))||
    !validText(job.createdAt,1,60)||!validText(job.updatedAt,1,60)) {
    throw new Error("invalid_stored_state");
  }
  return {
    id:job.id,kind:job.kind,prompt:job.prompt,context:job.context,
    status:job.status,engine:job.engine,output:job.output,
    createdAt:job.createdAt,updatedAt:job.updatedAt,
  };
}
function load(path,maxJobs){
  if(!checkFile(path))return [];
  let json;
  let fd;
  try{
    fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
    const st=lstatSync(path);
    if(st.size>MAX_BYTES)throw new Error("storage_limit_exceeded");
    const data=readFileSync(fd,"utf8");
    if(Buffer.byteLength(data,"utf8")>MAX_BYTES)throw new Error("storage_limit_exceeded");
    json=JSON.parse(data);
  }catch(error){
    if(error.message==="storage_limit_exceeded")throw error;
    throw new Error("invalid_stored_state");
  }finally{if(fd!==undefined)closeSync(fd);}
  if(!json||json.schema!==SCHEMA||!Array.isArray(json.tasks)||
     json.tasks.length>maxJobs)throw new Error("invalid_stored_state");
  const seen=new Set();
  return json.tasks.map(raw=>{
    const task=validateStoredJob(raw);
    if(seen.has(task.id))throw new Error("invalid_stored_state");
    seen.add(task.id);
    return task;
  });
}
function save(path,jobs){
  const dir=dirname(path);
  checkDirectory(dir);
  checkFile(path);
  const json=JSON.stringify({schema:SCHEMA,tasks:jobs});
  if(Buffer.byteLength(json,"utf8")>MAX_BYTES)throw new WorkError(507,"task_storage_capacity");
  const tmp=join(dir,"."+basename(path)+"."+randomUUID()+".tmp");
  let fd;
  try{
    fd=openSync(tmp,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|(constants.O_NOFOLLOW||0),0o600);
    writeFileSync(fd,json,"utf8");
    fsyncSync(fd);
    closeSync(fd);fd=undefined;
    renameSync(tmp,path);
    let dirFd;
    try{dirFd=openSync(dir,constants.O_RDONLY);fsyncSync(dirFd);}finally{if(dirFd!==undefined)closeSync(dirFd);}
  }catch(error){
    if(fd!==undefined)closeSync(fd);
    try{unlinkSync(tmp);}catch{}
    throw error;
  }
}
export function createFileBackedWorkEngine({path,infer,maxJobs=100}={}){
  if(typeof path!=="string"||!isAbsolute(path))throw new Error("absolute_storage_path_required");
  checkDirectory(dirname(path));
  const persisted=load(path,maxJobs);
  const interrupted=persisted.some(job=>job.status==="running");
  const restored=persisted.map(job=>job.status==="running"?{...job,status:"blocked"}:job);
  if(interrupted)save(path,restored);
  return createWorkEngine({
    infer,maxJobs,initialTasks:restored,
    persist:(tasks)=>save(path,tasks),
  });
}
