import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  nextWindowsInstallState,
  planWindowsInstall,
  planWindowsRollback,
  planWindowsUninstall,
  verifyWindowsInstallIdentity,
  verifyWindowsPackageFiles,
} from "../hercules-cleaner/windows-installer.mjs";

const commitSha="a".repeat(40);
const digest="b".repeat(64);
const candidate=(version="1.0.0")=>({version,commitSha,aggregateSha256:digest,releaseClass:"early_access",checkoutEnabled:false});

test("Windows installer plans a user-scoped versioned install without touching Cleaner state", () => {
  const plan=planWindowsInstall({
    localAppData:"C:\\Users\\Sauce\\AppData\\Local",
    home:"C:\\Users\\Sauce",
    version:"1.0.0",
    nodePath:"C:\\Program Files\\nodejs\\node.exe",
    sourceRoot:"D:\\HerculesCleanerRelease",
  });
  assert.equal(plan.scope,"user");
  assert.match(plan.installRoot,/SauceApproved[\\/]Hercules Cleaner[\\/]app[\\/]1\.0\.0$/);
  assert.match(plan.binPath,/SauceApproved[\\/]Hercules Cleaner[\\/]bin$/);
  assert.equal(plan.stateRoot,"C:\\Users\\Sauce\\.hercules-cleaner");
  assert.equal(plan.preserveState,true);
  assert.equal(plan.requiresElevation,false);
  assert.equal(plan.copySource,"D:\\HerculesCleanerRelease");
  assert.ok(plan.launcherContent.includes("hercules-cleaner\\cli.mjs"));
});

test("Windows installer rejects mutable, mismatched, or commercially unlocked release identity", () => {
  for (const bad of [
    {...candidate(),commitSha:"main"},
    {...candidate(),aggregateSha256:"c".repeat(64)},
    {...candidate(),releaseClass:"public"},
    {...candidate(),checkoutEnabled:true},
  ]) {
    const result=verifyWindowsInstallIdentity({candidate:bad,expected:{commitSha,aggregateSha256:digest}});
    assert.equal(result.allowed,false);
  }
});

test("Windows installer accepts exact immutable Early Access identity", () => {
  assert.deepEqual(
    verifyWindowsInstallIdentity({candidate:candidate(),expected:{commitSha,aggregateSha256:digest}}),
    {allowed:true,reason:"verified-install-identity"},
  );
});

test("Windows update state keeps the prior version as rollback and preserves state", () => {
  const result=nextWindowsInstallState({
    previous:{currentVersion:"1.0.0",currentCommitSha:"1".repeat(40),currentAggregateSha256:"2".repeat(64),stateRoot:"C:\\Users\\Sauce\\.hercules-cleaner"},
    candidate:candidate("1.1.0"),
    expected:{commitSha,aggregateSha256:digest},
    installedAt:"2026-09-29T06:45:00.000Z",
  });
  assert.equal(result.allowed,true);
  assert.equal(result.state.currentVersion,"1.1.0");
  assert.equal(result.state.rollbackVersion,"1.0.0");
  assert.equal(result.state.stateRoot,"C:\\Users\\Sauce\\.hercules-cleaner");
  assert.equal(result.state.installedAt,"2026-09-29T06:45:00.000Z");
});

test("Windows update refuses same-version replacement", () => {
  const result=nextWindowsInstallState({
    previous:{currentVersion:"1.0.0",currentCommitSha:"1".repeat(40),currentAggregateSha256:"2".repeat(64),stateRoot:"C:\\Users\\Sauce\\.hercules-cleaner"},
    candidate:candidate("1.0.0"),
    expected:{commitSha,aggregateSha256:digest},
  });
  assert.equal(result.allowed,false);
  assert.equal(result.reason,"version-not-newer");
});

test("Windows rollback points only to the retained prior app version", () => {
  const plan=planWindowsRollback({
    localAppData:"C:\\Users\\Sauce\\AppData\\Local",
    home:"C:\\Users\\Sauce",
    currentVersion:"1.1.0",
    rollbackVersion:"1.0.0",
    nodePath:"C:\\Program Files\\nodejs\\node.exe",
  });
  assert.match(plan.rollbackRoot,/app[\\/]1\.0\.0$/);
  assert.match(plan.currentRoot,/app[\\/]1\.1\.0$/);
  assert.equal(plan.stateRoot,"C:\\Users\\Sauce\\.hercules-cleaner");
  assert.equal(plan.preserveState,true);
});

test("Windows uninstall removes app integration but preserves recovery and state data", () => {
  const plan=planWindowsUninstall({
    localAppData:"C:\\Users\\Sauce\\AppData\\Local",
    home:"C:\\Users\\Sauce",
    version:"1.1.0",
  });
  assert.equal(plan.preserveState,true);
  assert.equal(plan.stateRoot,"C:\\Users\\Sauce\\.hercules-cleaner");
  assert.ok(plan.remove.every(path=>!path.includes(".hercules-cleaner")));
});

test("package verifier rejects a tampered Cleaner release file", async () => {
  const root=await mkdtemp(join(tmpdir(),"cleaner-installer-test-"));
  try {
    const path="payload.txt";
    const original=Buffer.from("verified payload","utf8");
    await writeFile(join(root,path),original);
    const fileDigest=createHash("sha256").update(original).digest("hex");
    const aggregateSha256=createHash("sha256").update(Buffer.from(path+":"+fileDigest,"utf8")).digest("hex");
    const manifest={files:[{path,bytes:original.length,sha256:fileDigest}],aggregateSha256};
    assert.deepEqual(await verifyWindowsPackageFiles({sourceRoot:root,manifest}),{allowed:true,reason:"verified-package-files"});
    await writeFile(join(root,path),"tampered");
    const bad=await verifyWindowsPackageFiles({sourceRoot:root,manifest});
    assert.equal(bad.allowed,false);
    assert.equal(bad.reason,"file-integrity-mismatch");
  } finally {
    await rm(root,{recursive:true,force:true});
  }
});
