import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {access, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, win32} from "node:path";
import {
  installWindowsCleaner,
  rollbackWindowsCleaner,
  uninstallWindowsCleaner,
} from "../hercules-cleaner/windows-installer.mjs";

const winOnly={skip:process.platform!=="win32"};

function sha256(bytes){return createHash("sha256").update(bytes).digest("hex")}

async function makePackage(root,version,body){
  const sourceRoot=join(root,"source-"+version);
  const path="hercules-cleaner/cli.mjs";
  const bytes=Buffer.from(body,"utf8");
  await mkdir(join(sourceRoot,"hercules-cleaner"),{recursive:true});
  await writeFile(join(sourceRoot,"hercules-cleaner","cli.mjs"),bytes);
  await writeFile(join(sourceRoot,"unlisted-extra.mjs"),"must never install\n");
  const fileDigest=sha256(bytes);
  const files=[{path,bytes:bytes.length,sha256:fileDigest}];
  const aggregateSha256=sha256(Buffer.from(path+":"+fileDigest,"utf8"));
  const commitSha=sha256(Buffer.from("commit-"+version)).slice(0,40);
  return {
    sourceRoot,
    candidate:{version,commitSha,aggregateSha256,releaseClass:"early_access",checkoutEnabled:false,files},
    expected:{commitSha,aggregateSha256},
  };
}

async function absent(path){
  try{await access(path);return false}catch(error){if(error?.code==="ENOENT")return true;throw error}
}

test("Windows install-update-rollback-uninstall preserves Cleaner state and copies verified files only",winOnly,async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-cleaner-win-"));
  const localAppData=join(root,"LocalAppData");
  const home=join(root,"Home");
  const stateRoot=join(home,".hercules-cleaner");
  const marker=join(stateRoot,"recovery-vault","keep.txt");
  await mkdir(join(stateRoot,"recovery-vault"),{recursive:true});
  await writeFile(marker,"preserve me");

  try{
    const v100=await makePackage(root,"1.0.0","export const version='1.0.0';\n");
    const first=await installWindowsCleaner({
      localAppData,home,sourceRoot:v100.sourceRoot,candidate:v100.candidate,expected:v100.expected,platform:"win32",nodePath:process.execPath,
      now:"2026-09-29T07:00:00.000Z",
    });
    assert.equal(first.installed,true);
    assert.equal(first.updated,false);
    assert.equal(await readFile(marker,"utf8"),"preserve me");
    assert.equal(
      await readFile(win32.join(first.plan.installRoot,"hercules-cleaner","cli.mjs"),"utf8"),
      "export const version='1.0.0';\n",
    );
    assert.equal(await absent(win32.join(first.plan.installRoot,"unlisted-extra.mjs")),true);

    const v110=await makePackage(root,"1.1.0","export const version='1.1.0';\n");
    const update=await installWindowsCleaner({
      localAppData,home,sourceRoot:v110.sourceRoot,candidate:v110.candidate,expected:v110.expected,platform:"win32",nodePath:process.execPath,
      now:"2026-09-29T07:01:00.000Z",
    });
    assert.equal(update.updated,true);
    assert.equal(update.state.currentVersion,"1.1.0");
    assert.equal(update.state.rollbackVersion,"1.0.0");
    assert.equal(await readFile(marker,"utf8"),"preserve me");
    assert.equal(await absent(win32.join(update.plan.installRoot,"unlisted-extra.mjs")),true);

    const rollback=await rollbackWindowsCleaner({
      localAppData,home,platform:"win32",nodePath:process.execPath,now:"2026-09-29T07:02:00.000Z",
    });
    assert.equal(rollback.state.currentVersion,"1.0.0");
    assert.equal(rollback.state.rollbackVersion,"1.1.0");
    assert.equal(await readFile(marker,"utf8"),"preserve me");

    const removed=await uninstallWindowsCleaner({localAppData,home,platform:"win32",nodePath:process.execPath});
    assert.equal(removed.uninstalled,true);
    assert.equal(removed.statePreserved,true);
    assert.equal(await readFile(marker,"utf8"),"preserve me");
    assert.equal(await absent(win32.join(localAppData,"SauceApproved","Hercules Cleaner")),true);
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});
