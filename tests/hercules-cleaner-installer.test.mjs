import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {
  activateInstalledVersion,
  buildUpdateDecision,
  compareVersions,
  createInstallLayout,
  validateArchiveEntries,
  validateUpdateChannel,
} from "../hercules-cleaner/installer.mjs";

test("semantic version comparison rejects downgrades and orders releases numerically", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.9", "1.0.10"), -1);
  assert.equal(compareVersions("2.0.0", "1.99.99"), 1);
  assert.throws(() => compareVersions("v1", "1.0.0"), /semantic version/i);
});

test("Windows install layout is per-user and keeps cleaner state outside the install tree", () => {
  const layout=createInstallLayout({
    platform:"win32",
    home:"C:\\Users\\Sauce",
    localAppData:"C:\\Users\\Sauce\\AppData\\Local",
    version:"1.0.0",
  });
  assert.equal(layout.installRoot,"C:\\Users\\Sauce\\AppData\\Local\\SauceApproved\\Hercules Cleaner");
  assert.equal(layout.versionRoot,"C:\\Users\\Sauce\\AppData\\Local\\SauceApproved\\Hercules Cleaner\\versions\\1.0.0");
  assert.equal(layout.stateRoot,"C:\\Users\\Sauce\\.hercules-cleaner");
  assert.ok(!layout.stateRoot.startsWith(layout.installRoot));
});

test("update channel is fail-closed, HTTPS-only, hash-bound, and host constrained", () => {
  const valid={
    schema:"sauceapproved.hercules-cleaner.update-channel",
    channel:"early_access",
    enabled:true,
    version:"1.1.0",
    sourceCommit:"a".repeat(40),
    artifactUrl:"https://github.com/Sauceapproved7/expert-doodle/releases/download/hercules-cleaner-v1.1.0/hercules-cleaner-windows-v1.1.0.zip",
    artifactSha256:"b".repeat(64),
    minimumNodeMajor:22,
  };
  assert.equal(validateUpdateChannel(valid).version,"1.1.0");
  assert.throws(()=>validateUpdateChannel({...valid,artifactUrl:"http://github.com/file.zip"}),/HTTPS/i);
  assert.throws(()=>validateUpdateChannel({...valid,artifactUrl:"https://evil.example/file.zip"}),/host/i);
  assert.throws(()=>validateUpdateChannel({...valid,artifactSha256:"abc"}),/SHA-256/i);
  assert.throws(()=>validateUpdateChannel({...valid,sourceCommit:"main"}),/commit/i);
});

test("disabled update channel and same-version/downgrade channels never apply", () => {
  const base={
    schema:"sauceapproved.hercules-cleaner.update-channel",
    channel:"early_access",
    enabled:true,
    version:"1.1.0",
    sourceCommit:"a".repeat(40),
    artifactUrl:"https://github.com/Sauceapproved7/expert-doodle/releases/download/x/file.zip",
    artifactSha256:"b".repeat(64),
    minimumNodeMajor:22,
  };
  assert.deepEqual(buildUpdateDecision({currentVersion:"1.0.0",channel:{...base,enabled:false}}),{action:"hold",reason:"channel-disabled"});
  assert.deepEqual(buildUpdateDecision({currentVersion:"1.1.0",channel:base}),{action:"hold",reason:"already-current"});
  assert.deepEqual(buildUpdateDecision({currentVersion:"2.0.0",channel:base}),{action:"hold",reason:"downgrade-blocked"});
  assert.equal(buildUpdateDecision({currentVersion:"1.0.0",channel:base}).action,"update");
});

test("archive entry validation blocks traversal, absolute paths, and drive-qualified paths", () => {
  assert.deepEqual(validateArchiveEntries([
    "bundle/app/hercules-cleaner/cli.mjs",
    "bundle/windows/Install-HerculesCleaner.ps1",
  ]),[
    "bundle/app/hercules-cleaner/cli.mjs",
    "bundle/windows/Install-HerculesCleaner.ps1",
  ]);
  for(const bad of ["../evil.txt","bundle/../../evil.txt","/absolute/file","C:/Windows/System32/evil.dll","C:\\Windows\\evil.dll"]){
    assert.throws(()=>validateArchiveEntries([bad]),/unsafe archive entry/i,bad);
  }
});

test("activation rolls back the active pointer when health verification fails", async () => {
  const root=await mkdtemp(join(tmpdir(),"hercules-cleaner-installer-"));
  try{
    await mkdir(join(root,"versions","1.0.0"),{recursive:true});
    await mkdir(join(root,"versions","1.1.0"),{recursive:true});
    await writeFile(join(root,"active.json"),JSON.stringify({version:"1.0.0",versionRoot:join(root,"versions","1.0.0")}));
    await assert.rejects(
      ()=>activateInstalledVersion({
        installRoot:root,
        version:"1.1.0",
        healthCheck:async()=>({ok:false,error:"health-failed"}),
        now:()=>new Date("2026-09-28T13:00:00Z"),
      }),
      /health-failed/
    );
    const active=JSON.parse(await readFile(join(root,"active.json"),"utf8"));
    assert.equal(active.version,"1.0.0");
    const receipt=JSON.parse(await readFile(join(root,"update-receipts","2026-09-28T13-00-00-000Z.json"),"utf8"));
    assert.equal(receipt.status,"rolled_back");
    assert.equal(receipt.previousVersion,"1.0.0");
    assert.equal(receipt.attemptedVersion,"1.1.0");
  }finally{await rm(root,{recursive:true,force:true})}
});

test("activation commits only after a successful health check and records an update receipt", async () => {
  const root=await mkdtemp(join(tmpdir(),"hercules-cleaner-installer-"));
  try{
    await mkdir(join(root,"versions","1.0.0"),{recursive:true});
    await mkdir(join(root,"versions","1.1.0"),{recursive:true});
    await writeFile(join(root,"active.json"),JSON.stringify({version:"1.0.0",versionRoot:join(root,"versions","1.0.0")}));
    const result=await activateInstalledVersion({
      installRoot:root,
      version:"1.1.0",
      sourceCommit:"c".repeat(40),
      artifactSha256:"d".repeat(64),
      healthCheck:async({versionRoot})=>({ok:versionRoot.endsWith(join("versions","1.1.0"))}),
      now:()=>new Date("2026-09-28T13:01:00Z"),
    });
    assert.equal(result.status,"activated");
    const active=JSON.parse(await readFile(join(root,"active.json"),"utf8"));
    assert.equal(active.version,"1.1.0");
    assert.equal(active.sourceCommit,"c".repeat(40));
    const receipt=JSON.parse(await readFile(join(root,"update-receipts","2026-09-28T13-01-00-000Z.json"),"utf8"));
    assert.equal(receipt.status,"activated");
    assert.equal(receipt.artifactSha256,"d".repeat(64));
  }finally{await rm(root,{recursive:true,force:true})}
});

test("Windows installer scripts are per-user, rollback-aware, and do not bypass PowerShell execution policy", async () => {
  const base=new URL("../hercules-cleaner/windows/",import.meta.url);
  const install=await readFile(new URL("Install-HerculesCleaner.ps1",base),"utf8");
  const update=await readFile(new URL("Update-HerculesCleaner.ps1",base),"utf8");
  const uninstall=await readFile(new URL("Uninstall-HerculesCleaner.ps1",base),"utf8");
  const launcher=await readFile(new URL("Launch-HerculesCleaner.ps1",base),"utf8");
  const cmd=await readFile(new URL("install.cmd",base),"utf8");
  assert.match(install,/LOCALAPPDATA/);
  assert.match(install,/Node\.js 22/i);
  assert.match(install,/install-autostart/);
  assert.match(install,/Hercules Cleaner\.lnk/);
  assert.match(update,/Get-FileHash/);
  assert.match(update,/SHA256/);
  assert.match(update,/tar\.exe/);
  assert.match(update,/installer\.mjs/);
  assert.match(uninstall,/RemoveUserData/);
  assert.match(uninstall,/\.hercules-cleaner/);
  assert.match(launcher,/active\.json/);
  assert.doesNotMatch(cmd,/ExecutionPolicy\s+Bypass/i);
  assert.doesNotMatch(install,/RunAs|requireAdministrator/i);
});
