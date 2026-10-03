import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("SoundWorld Pods restores the pre-EVT energy/runtime budget", async () => {
  const s = await read("../hardware/soundworld/wearables/PODS_ENERGY_BUDGET_01.md");
  assert.match(s, /15%/);
  assert.match(s, /8-hour target/);
  assert.match(s, /10-hour stretch target/);
  assert.match(s, /not a runtime claim/i);
});

test("SoundWorld Max has a serviceable battery and charging freeze", async () => {
  const s = await read("../hardware/soundworld/wearables/MAX_BATTERY_CHARGING_FREEZE_01.md");
  assert.match(s, /service/i);
  assert.match(s, /USB-C/);
  assert.match(s, /Acoustic Twin/);
  assert.match(s, /Creator Monitor/);
  assert.match(s, /not.*runtime claim/i);
});

test("SoundWorld Max has a measured-energy release gate", async () => {
  const s = await read("../hardware/soundworld/wearables/MAX_ENERGY_BUDGET_01.md");
  assert.match(s, /30-hour/);
  assert.match(s, /40-hour stretch/);
  assert.match(s, /firmware/i);
  assert.match(s, /production-equivalent hardware/i);
});

test("SoundWorld program handoff keeps all three products evidence-gated", async () => {
  const s = await read("../hardware/soundworld/SOUNDWORLD_PROGRAM_STATUS_01.md");
  for (const name of ["Portable Speaker", "SoundWorld Pods", "SoundWorld Max"]) {
    assert.match(s, new RegExp(name));
  }
  assert.match(s, /physical.*EVT/i);
  assert.match(s, /DVT.*blocked/i);
  assert.match(s, /customer-facing claims.*blocked/i);
});
