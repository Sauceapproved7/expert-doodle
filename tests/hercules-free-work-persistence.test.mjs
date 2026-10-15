import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, readFileSync, rmSync, chmodSync, symlinkSync, statSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createFileBackedWorkEngine} from "../hercules-runtime/free-work-persistence.mjs";
import {WorkError} from "../hercules-runtime/free-work-core.mjs";

async function withPrivateDir(fn) {
  const dir=mkdtempSync(join(tmpdir(),"hercules-work-private-"));
  chmodSync(dir,0o700);
  try{return await fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}
}

test("tasks survive engine restart in private file store",async()=>{
  await withPrivateDir(async dir=>{
    const path=join(dir,"work.json");
    const a=createFileBackedWorkEngine({path});
    const task=a.createTask({kind:"plan",prompt:"Plan global launch"});
    const completed=await a.runTask(task.id);
    assert.equal(completed.status,"completed");
    const b=createFileBackedWorkEngine({path});
    assert.equal(b.getTask(task.id).output,completed.output);
    assert.equal(b.listTasks()[0].status,"completed");
    assert.equal(statSync(path).mode&0o777,0o600);
  });
});

test("context is retained privately but not leaked into list output",()=>withPrivateDir(dir=>{
  const a=createFileBackedWorkEngine({path:join(dir,"work.json")});
  const task=a.createTask({kind:"review",prompt:"Look at code",context:"internal-only-needle"});
  assert.doesNotMatch(JSON.stringify(a.listTasks()),/internal-only-needle/);
  assert.equal(a.getTask(task.id).context,"internal-only-needle");
}));

test("recovered running jobs fail closed instead of replaying side effects",()=>withPrivateDir(async dir=>{
  const path=join(dir,"work.json");
  const a=createFileBackedWorkEngine({path});
  const t=a.createTask({kind:"plan",prompt:"Plan a task"});
  const saved=JSON.parse(readFileSync(path,"utf8"));
  saved.tasks[0].status="running";
  writeFileSync(path,JSON.stringify(saved),{mode:0o600});
  const b=createFileBackedWorkEngine({path});
  assert.equal(b.getTask(t.id).status,"blocked");
  await assert.rejects(b.runTask(t.id),error=>error.status===409);
}));

test("directory or file permission vulnerabilities fail closed",()=>withPrivateDir(dir=>{
  chmodSync(dir,0o755);
  assert.throws(()=>createFileBackedWorkEngine({path:join(dir,"work.json")}),/private_directory_required/);
  chmodSync(dir,0o700);
  const path=join(dir,"work.json");
  const store=createFileBackedWorkEngine({path});
  store.createTask({kind:"plan",prompt:"Secure"});
  chmodSync(path,0o644);
  assert.throws(()=>createFileBackedWorkEngine({path}),/private_file_required/);
}));

test("symlinked storage file fails closed",()=>withPrivateDir(dir=>{
  const outside=join(dir,"outside.txt");
  writeFileSync(outside,"secret",{mode:0o600});
  symlinkSync(outside,join(dir,"work.json"));
  assert.throws(()=>createFileBackedWorkEngine({path:join(dir,"work.json")}),/storage_symlink_denied/);
  assert.equal(readFileSync(outside,"utf8"),"secret");
}));

test("corrupted JSON store never silently replaces state",()=>withPrivateDir(dir=>{
  const path=join(dir,"work.json");
  writeFileSync(path,"not-json",{mode:0o600});
  assert.throws(()=>createFileBackedWorkEngine({path}),/invalid_stored_state/);
  assert.equal(readFileSync(path,"utf8"),"not-json");
}));

test("writes do not accept relative paths or missing private directory",()=>withPrivateDir(dir=>{
  assert.throws(()=>createFileBackedWorkEngine({path:"./task-store.json"}),/absolute_storage_path_required/);
  assert.throws(()=>createFileBackedWorkEngine({path:join(dir,"missing","store.json")}),/private_directory_required/);
}));

test("task additions stop before destructive overflow",()=>withPrivateDir(dir=>{
  const path=join(dir,"work.json");
  const a=createFileBackedWorkEngine({path,maxJobs:1});
  a.createTask({kind:"plan",prompt:"First"});
  assert.throws(()=>a.createTask({kind:"plan",prompt:"Second"}),error=>error instanceof WorkError&&error.status===429);
  const b=createFileBackedWorkEngine({path,maxJobs:1});
  assert.equal(b.listTasks().length,1);
}));
