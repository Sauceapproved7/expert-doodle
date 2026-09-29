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
  validateInstallIdentity,
} from "../hercules-cleaner/installer.mjs";

const commit="a".repeat(40), digest="b".repeat(64);
const enabledChannel={
  schema:"sauceapproved.hercules-cleaner.update-channel",
  channel:"early_access",
  enabled:true,
  version:"1.1.0",
  sourceCommit:commit,
  artifactUrl:"https://github.com/Sauceapproved7/expert-doodle/releases/download/hercules-cleaner-v1.1.0/hercules-cleaner-windows-v1.1.0.zip",
  artifactSha256:digest,
  minimumNodeMajor:22,
  releaseClass:"early_access",
  checkoutEnabled:false,
};

test("semantic version comparison orders releases numerically",()=>{
  assert.equal(compareVersions("1.0.0","1.0.0"),0);
  assert.equal(compareVersions("1.0.9","1.0.10"),-1);
  assert.equal(compareVersions("2.0.0","1.99.99"),1);
  assert.throws(()=>compareVersions("v1","1.0.0"),/semantic version/i);
});

test("Windows install layout is per-user and state stays outside the app tree",()=>{
  const layout=createInstallLayout({platform:"win32",home:"C:\\Users\\Sauce",localAppData:"C:\\Users\\Sauce\\AppData\\Local",version:"1.0.0"});
  assert.equal(layout.installRoot,"C:\\Users\\Sauce\\AppData\\Local\\SauceApproved\\Hercules Cleaner");
  assert.equal(layout.versionRoot,"C:\\Users\\Sauce\\AppData\\Local\\SauceApproved\\Hercules Cleaner\\versions\\1.0.0");
  assert.equal(layout.stateRoot,"C:\\Users\\Sauce\\.hercules-cleaner");
  assert.ok(!layout.stateRoot.startsWith(layout.installRoot));
});

test("enabled update channels are HTTPS, hash, commit, and commercial-gate constrained",()=>{
  assert.equal(validateUpdateChannel(enabledChannel).version,"1.1.0");
  assert.throws(()=>validateUpdateChannel({...enabledChannel,artifactUrl:"http://github.com/file.zip"}),/HTTPS/i);
  assert.throws(()=>validateUpdateChannel({...enabledChannel,artifactUrl:"https://evil.example/file.zip"}),/host/i);
  assert.throws(()=>validateUpdateChannel({...enabledChannel,artifactSha256:"abc"}),/SHA-256/i);
  assert.throws(()=>validateUpdateChannel({...enabledChannel,sourceCommit:"main"}),/commit/i);
  assert.throws(()=>validateUpdateChannel({...enabledChannel,checkoutEnabled:true}),/commercial/i);
});

test("automatic update requires separately trusted exact release identity",()=>{
  assert.deepEqual(buildUpdateDecision({currentVersion:"1.0.0",channel:{...enabledChannel,enabled:false}}),{action:"hold",reason:"channel-disabled"});
  assert.deepEqual(buildUpdateDecision({currentVersion:"1.0.0",channel:enabledChannel}),{action:"hold",reason:"expected-update-identity-required"});
  assert.equal(buildUpdateDecision({currentVersion:"1.0.0",channel:enabledChannel,expected:{commitSha:commit,aggregateSha256:digest}}).action,"update");
  assert.equal(buildUpdateDecision({currentVersion:"1.0.0",channel:enabledChannel,expected:{commitSha:"c".repeat(40),aggregateSha256:digest}}).reason,"update-identity-mismatch");
});

test("archive validation blocks traversal, absolute paths, and drive-qualified paths",()=>{
  assert.equal(validateArchiveEntries(["app/hercules-cleaner/cli.mjs","Install-HerculesCleaner.ps1"]).length,2);
  for(const bad of ["../evil.txt","bundle/../../evil.txt","/absolute/file","C:/Windows/System32/evil.dll","C:\\Windows\\evil.dll"]){
    assert.throws(()=>validateArchiveEntries([bad]),/unsafe archive entry/i,bad);
  }
});

test("activation leaves the previous pointer active and writes rollback evidence on health failure",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-cleaner-installer-"));
  try{
    await mkdir(join(root,"versions","1.0.0"),{recursive:true});
    await mkdir(join(root,"versions","1.1.0"),{recursive:true});
    await writeFile(join(root,"active.json"),JSON.stringify({version:"1.0.0",versionRoot:join(root,"versions","1.0.0")}));
    await assert.rejects(()=>activateInstalledVersion({
      installRoot:root,version:"1.1.0",
      healthCheck:async()=>({ok:false,error:"health-failed"}),
      now:()=>new Date("2026-09-28T13:00:00Z"),
    }),/health-failed/);
    assert.equal(JSON.parse(await readFile(join(root,"active.json"),"utf8")).version,"1.0.0");
    const receipt=JSON.parse(await readFile(join(root,"update-receipts","2026-09-28T13-00-00-000Z.json"),"utf8"));
    assert.equal(receipt.status,"rolled_back");
    assert.equal(receipt.previousVersion,"1.0.0");
  }finally{await rm(root,{recursive:true,force:true})}
});

test("activation commits only after health success and records immutable identity",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-cleaner-installer-"));
  try{
    await mkdir(join(root,"versions","1.0.0"),{recursive:true});
    await mkdir(join(root,"versions","1.1.0"),{recursive:true});
    await writeFile(join(root,"active.json"),JSON.stringify({version:"1.0.0",versionRoot:join(root,"versions","1.0.0")}));
    const result=await activateInstalledVersion({
      installRoot:root,version:"1.1.0",sourceCommit:"c".repeat(40),artifactSha256:"d".repeat(64),
      healthCheck:async({versionRoot})=>({ok:versionRoot.endsWith(join("versions","1.1.0"))}),
      now:()=>new Date("2026-09-28T13:01:00Z"),
    });
    assert.equal(result.status,"activated");
    const active=JSON.parse(await readFile(join(root,"active.json"),"utf8"));
    assert.equal(active.version,"1.1.0");
    assert.equal(active.sourceCommit,"c".repeat(40));
  }finally{await rm(root,{recursive:true,force:true})}
});

test("Windows scripts are per-user and never bypass execution policy",async()=>{
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


test("initial Windows install requires a separately trusted exact release identity",()=>{
  const bundle={version:"1.0.0",sourceCommit:commit,aggregateSha256:digest,releaseClass:"early_access"};
  assert.throws(()=>validateInstallIdentity({bundle}),/expected install identity required/i);
  assert.deepEqual(
    validateInstallIdentity({bundle,expected:{version:"1.0.0",commitSha:commit,aggregateSha256:digest}}),
    {version:"1.0.0",commitSha:commit,aggregateSha256:digest}
  );
  assert.throws(
    ()=>validateInstallIdentity({bundle,expected:{version:"1.0.0",commitSha:"c".repeat(40),aggregateSha256:digest}}),
    /install identity mismatch/i
  );
});

test("successful update activation retains exact previous identity for rollback",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-cleaner-rollback-identity-"));
  try{
    await mkdir(join(root,"versions","1.0.0"),{recursive:true});
    await mkdir(join(root,"versions","1.1.0"),{recursive:true});
    await writeFile(join(root,"active.json"),JSON.stringify({
      schema:"sauceapproved.hercules-cleaner.active-install",
      version:"1.0.0",
      versionRoot:join(root,"versions","1.0.0"),
      sourceCommit:"1".repeat(40),
      artifactSha256:"2".repeat(64),
    }));
    await activateInstalledVersion({
      installRoot:root,version:"1.1.0",sourceCommit:"3".repeat(40),artifactSha256:"4".repeat(64),
      healthCheck:async()=>({ok:true}),
      now:()=>new Date("2026-09-29T13:20:00Z"),
    });
    const active=JSON.parse(await readFile(join(root,"active.json"),"utf8"));
    assert.deepEqual(active.rollback,{
      version:"1.0.0",
      versionRoot:join(root,"versions","1.0.0"),
      sourceCommit:"1".repeat(40),
      artifactSha256:"2".repeat(64),
    });
  }finally{await rm(root,{recursive:true,force:true})}
});

test("Windows uninstall source fails closed instead of swallowing integration-removal errors",async()=>{
  const uninstall=await readFile(new URL("../hercules-cleaner/windows/Uninstall-HerculesCleaner.ps1",import.meta.url),"utf8");
  assert.doesNotMatch(uninstall,/catch\s*\{\s*\}/);
  assert.match(uninstall,/if\s*\(\$LASTEXITCODE\s*-ne\s*0\).*throw/is);
  assert.doesNotMatch(uninstall,/Remove-Item\s+-LiteralPath\s+\$InstallRoot[^\r\n]*ErrorAction\s+SilentlyContinue/i);
});
