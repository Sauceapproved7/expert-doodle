import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRunManifest,
  fingerprint,
  routeShot,
  selectBestRender,
  weightedQualityScore,
} from "../hercules-video/core.mjs";
import {HerculesVideoAdapter, assertAdapterBoundary} from "../hercules-video/adapter.mjs";

const shot = {
  id: "hero-01",
  prompt: "Dark premium deployment verification shot",
  durationSeconds: 8,
  aspectRatio: "9:16",
  requiresAudio: true,
};

const provider = (id, quality, credits = 2) => ({
  id,
  label: id.toUpperCase(),
  capabilities: {
    aspectRatios: ["9:16", "16:9"],
    maxDurationSeconds: 30,
    nativeAudio: true,
    references: true,
    editing: true,
  },
  quality,
  cost: {estimatedCreditsPerSecond: credits},
});

test("routes to the highest-quality provider under budget", () => {
  const low = provider("low", {promptAdherence:0.7,temporalConsistency:0.7,visualQuality:0.7,brandConsistency:0.7,audioQuality:0.7,artifactFreedom:0.7,reliability:0.9}, 1);
  const high = provider("high", {promptAdherence:0.95,temporalConsistency:0.94,visualQuality:0.96,brandConsistency:0.95,audioQuality:0.9,artifactFreedom:0.92,reliability:0.9}, 2);
  const result = routeShot(shot, [low, high], {maxCredits: 100});
  assert.equal(result.status, "routed");
  assert.equal(result.selected.providerId, "high");
});

test("blocks rather than silently violating shot requirements", () => {
  const noAudio = {
    ...provider("silent", {}, 1),
    capabilities: {...provider("silent", {}, 1).capabilities, nativeAudio: false},
  };
  const result = routeShot(shot, [noAudio], {maxCredits: 100});
  assert.equal(result.status, "blocked");
});

test("selects the strongest render by Hercules quality scoring", () => {
  const winner = selectBestRender([
    {id:"a",providerId:"p1",quality:{promptAdherence:.7,temporalConsistency:.8,visualQuality:.75,brandConsistency:.8,audioQuality:.7,artifactFreedom:.8,reliability:.9}},
    {id:"b",providerId:"p2",quality:{promptAdherence:.95,temporalConsistency:.95,visualQuality:.93,brandConsistency:.96,audioQuality:.91,artifactFreedom:.94,reliability:.9}},
  ]);
  assert.equal(winner.id, "b");
  assert.ok(winner.evaluation.score > 0.9);
});

test("manifest fingerprint is deterministic and policy preserves provenance", () => {
  const p = provider("engine-a", {promptAdherence:.9,temporalConsistency:.9,visualQuality:.9,brandConsistency:.9,audioQuality:.9,artifactFreedom:.9,reliability:.9});
  const a = buildRunManifest({projectId:"launch",brief:{title:"Hercules Launch"},shots:[shot],providers:[p]});
  const b = buildRunManifest({projectId:"launch",brief:{title:"Hercules Launch"},shots:[shot],providers:[p]});
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.policy.preserveProvenance, true);
  assert.equal(fingerprint({b:2,a:1}), fingerprint({a:1,b:2}));
});

test("adapter boundary is ours and provider implementations stay replaceable", () => {
  const adapter = new HerculesVideoAdapter({id:"example"});
  assert.equal(assertAdapterBoundary(adapter), true);
  assert.equal(typeof adapter.generate, "function");
});

test("weighted quality stays normalized", () => {
  assert.equal(weightedQualityScore({promptAdherence: 5}), 0.24);
});
