import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const launch=readFileSync(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");
const studio=readFileSync(new URL("../hercules-forge/ad-studio/index.html",import.meta.url),"utf8");

test("authenticated Hercules workspace exposes Ad Studio navigation and view",()=>{
  assert.match(launch,/data-view="adStudioView"/);
  assert.match(launch,/id="adStudioView"/);
  assert.match(launch,/id="adStudioFrame"/);
  assert.match(launch,/Hercules Ad Studio/);
});

test("deployed Ad Studio payload is byte-identical to the canonical standalone source",()=>{
  const match=launch.match(/const AD_STUDIO_SRC_B64="([A-Za-z0-9+/=]+)"/);
  assert.ok(match,"launch source must embed the canonical Ad Studio payload");
  assert.equal(Buffer.from(match[1],"base64").toString("utf8"),studio);
});

test("Ad Studio payload loads only from the authenticated app view",()=>{
  assert.match(launch,/function ensureAdStudioLoaded\(\)/);
  assert.match(launch,/if\(b\.dataset\.view==="adStudioView"\)ensureAdStudioLoaded\(\)/);
  const appIndex=launch.indexOf('<section id="app" class="hidden">');
  const studioViewIndex=launch.indexOf('id="adStudioView"');
  assert.ok(appIndex>=0&&studioViewIndex>appIndex);
});
