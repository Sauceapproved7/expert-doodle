import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp, readFile, rm, stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {buildWindowsInstallerBundle} from "../scripts/package-hercules-cleaner-windows.mjs";

const sha256=(bytes)=>createHash("sha256").update(bytes).digest("hex");

test("Windows bundle is exact-commit owner-code-only and does not claim publisher signing",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hercules-cleaner-win-bundle-"));
  try{
    const result=await buildWindowsInstallerBundle({commitSha:"a".repeat(40),outputDir:root});
    const manifest=JSON.parse(await readFile(join(root,"bundle-manifest.json"),"utf8"));
    assert.equal(manifest.schema,"sauceapproved.hercules-cleaner.windows-bundle");
    assert.equal(manifest.version,"1.0.0");
    assert.equal(manifest.sourceCommit,"a".repeat(40));
    assert.equal(manifest.minimumNodeMajor,22);
    assert.equal(manifest.publisherSigning.authenticodeSigned,false);
    assert.equal(manifest.publisherSigning.stableReleaseAllowed,false);
    assert.equal(manifest.userDataPreservedAcrossUpdates,true);
    assert.equal(manifest.autoUpdate.trustedExpectedIdentityRequired,true);
    assert.equal((await stat(join(root,"install.cmd"))).isFile(),true);
    assert.equal((await stat(join(root,"Install-HerculesCleaner.ps1"))).isFile(),true);
    assert.equal((await stat(join(root,"app","hercules-cleaner","cli.mjs"))).isFile(),true);
    assert.equal((await stat(join(root,"app","hercules-cleaner","installer.mjs"))).isFile(),true);
    for(const item of manifest.files){
      const bytes=await readFile(join(root,item.path));
      assert.equal(sha256(bytes),item.sha256,item.path);
      assert.doesNotMatch(item.path,/\.(exe|dll|msi|node)$/i);
    }
    assert.match(result.aggregateSha256,/^[a-f0-9]{64}$/);
  }finally{await rm(root,{recursive:true,force:true})}
});

test("public Early Access update channel remains disabled until trust and distribution are ready",async()=>{
  const channel=JSON.parse(await readFile(new URL("../releases/hercules-cleaner-v1.0.0/windows/update-channel.json",import.meta.url),"utf8"));
  assert.equal(channel.schema,"sauceapproved.hercules-cleaner.update-channel");
  assert.equal(channel.channel,"early_access");
  assert.equal(channel.enabled,false);
  assert.equal(channel.version,"1.0.0");
  assert.equal(channel.minimumNodeMajor,22);
  assert.equal(channel.releaseClass,"early_access");
  assert.equal(channel.checkoutEnabled,false);
  assert.equal(channel.artifactUrl,null);
  assert.equal(channel.artifactSha256,null);
  assert.match(channel.reason,/trusted expected release identity|publisher-signing/i);
});
