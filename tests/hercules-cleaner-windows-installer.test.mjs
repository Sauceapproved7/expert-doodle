import test from "node:test";
import assert from "node:assert/strict";
import {planWindowsInstall, planWindowsUninstall, verifyWindowsInstallIdentity} from "../hercules-cleaner/windows-installer.mjs";

const commitSha="a".repeat(40);
const digest="b".repeat(64);

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
  for (const candidate of [
    {version:"1.0.0",commitSha:"main",aggregateSha256:digest,releaseClass:"early_access",checkoutEnabled:false},
    {version:"1.0.0",commitSha,aggregateSha256:"c".repeat(64),releaseClass:"early_access",checkoutEnabled:false},
    {version:"1.0.0",commitSha,aggregateSha256:digest,releaseClass:"public",checkoutEnabled:false},
    {version:"1.0.0",commitSha,aggregateSha256:digest,releaseClass:"early_access",checkoutEnabled:true},
  ]) {
    const result=verifyWindowsInstallIdentity({
      candidate,
      expected:{commitSha,aggregateSha256:digest},
    });
    assert.equal(result.allowed,false);
  }
});

test("Windows installer accepts exact immutable Early Access identity", () => {
  const result=verifyWindowsInstallIdentity({
    candidate:{version:"1.0.0",commitSha,aggregateSha256:digest,releaseClass:"early_access",checkoutEnabled:false},
    expected:{commitSha,aggregateSha256:digest},
  });
  assert.deepEqual(result,{allowed:true,reason:"verified-install-identity"});
});

test("Windows uninstall removes app integration but preserves recovery and state data", () => {
  const plan=planWindowsUninstall({
    localAppData:"C:\\Users\\Sauce\\AppData\\Local",
    home:"C:\\Users\\Sauce",
    version:"1.0.0",
  });
  assert.equal(plan.preserveState,true);
  assert.equal(plan.stateRoot,"C:\\Users\\Sauce\\.hercules-cleaner");
  assert.ok(plan.remove.every(path=>!path.includes(".hercules-cleaner")));
});
