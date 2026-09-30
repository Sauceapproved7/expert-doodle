import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const launch=readFileSync(resolve(root,"supabase/functions/hercules-launch/index.ts"),"utf8");

test("authenticated Hercules app exposes SoundWorld launch-gift status through shared bearer-auth fetch",()=>{
  assert.match(launch,/soundworldGiftStatus/);
  assert.match(launch,/soundworld_launch_gift=1/);
  assert.match(launch,/hercules-private-bridge/);
  assert.match(launch,/o\.headers\.Authorization="Bearer "\+t/);
});

test("customer claim UI renders all three SoundWorld choices per eligible purchase",()=>{
  assert.match(launch,/SoundWorld Pods/);
  assert.match(launch,/SoundWorld Max/);
  assert.match(launch,/SoundWorld Portable Speaker/);
  assert.match(launch,/soundworld-pods/);
  assert.match(launch,/soundworld-max/);
  assert.match(launch,/soundworld-portable-speaker/);
});

test("customer claim UI locks claimed purchases and never auto-claims",()=>{
  assert.match(launch,/gift_already_reserved_for_purchase/);
  assert.match(launch,/claimed|reserved/);
  assert.doesNotMatch(launch,/autoClaimSoundWorldGift/);
});

test("existing magic-link SoundWorld claim page remains preserved",()=>{
  assert.match(launch,/soundworld-gift-access\.ts/);
  assert.match(launch,/isSoundWorldGiftAccessPage/);
  assert.match(launch,/soundworld_gift_access_request/);
});
