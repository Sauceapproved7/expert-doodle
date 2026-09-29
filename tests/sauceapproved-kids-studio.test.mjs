import assert from "node:assert/strict";
import test from "node:test";
import {createStudioHttpHandler} from "../hercules-video/studio-server.mjs";

test("Kids Studio v2 exposes parent-operated story kits and the expanded creative control layer",async()=>{
  const handle=createStudioHttpHandler();
  const manifest=JSON.parse((await handle({method:"GET",pathname:"/api/studio/kids/manifest"})).body);
  assert.equal(manifest.version,2);
  assert.equal(manifest.kits.length,3);
  assert.equal(manifest.storage,"device-only");
  assert.equal(manifest.serverUpload,false);
  assert.equal(manifest.childAccounts,false);
  assert.equal(manifest.publishing,false);
  assert.deepEqual(manifest.reviewPolicy.requiredChecks,["operator","privacy","permission","sharing"]);
  assert.equal(manifest.reviewPolicy.saveRequiresFreshPreview,true);
  for(const kit of manifest.kits) assert.equal(kit.differentiators.length,2);
  for(const capability of ["Storyboard Deck","Camera Coach","Sound Map","Transition Lab","Parent Cut Lock","Mood-to-Motion Map"]) {
    assert.ok(manifest.capabilities.some(item=>item.name===capability),capability);
  }

  const page=await handle({method:"GET",pathname:"/kids"});
  assert.equal(page.status,200);
  assert.match(page.body,/Neighborhood Hero/);
  assert.match(page.body,/Dream Director/);
  assert.match(page.body,/Time Capsule/);
  assert.match(page.body,/Storyboard Deck/);
  assert.match(page.body,/Camera Coach/);
  assert.match(page.body,/Sound Map/);
  assert.match(page.body,/Transition Lab/);
  assert.match(page.body,/Parent Cut Lock/);
  assert.match(page.body,/Parent review required/);
  assert.doesNotMatch(page.body,/boy campaign|girl campaign/i);
  assert.deepEqual(manifest.kits.map(kit=>kit.genre),["Adventure","Creative spotlight","Family keepsake"]);
  assert.match(page.headers["content-security-policy"],/script-src 'self'/);

  const client=await handle({method:"GET",pathname:"/assets/kids-studio.js"});
  assert.equal(client.status,200);
  for(const feature of [
    "Choice Compass","Courage Replay","beat-board","role-swap","then-now","privacy-check",
    "shot-style","sound-plan","transition-style","story-energy","storyboard",
    "review-operator","review-privacy","review-permission","review-sharing"
  ]) assert.match(client.body,new RegExp(feature));

  const root=await handle({method:"GET",pathname:"/"});
  assert.match(root.body,/href="\/kids"/);
  const studio=JSON.parse((await handle({method:"GET",pathname:"/api/studio/manifest"})).body);
  assert.ok(studio.surfaces.some(surface=>surface.id==="kids"));

  const mutation=await handle({method:"POST",pathname:"/api/studio/kids/export"});
  assert.notEqual(mutation.status,200);
});
