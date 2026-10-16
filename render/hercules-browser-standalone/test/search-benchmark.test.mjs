import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { resolveHerculesInput } from "../public/search-intent.mjs";

const CASES = [
  ["search", "best wholesale hoodie suppliers", "google"],
  ["duckduckgo", "free hosting comparison", "duckduckgo"],
  ["domain", "example.com", "google"],
  ["url", "https://example.com/products?q=hoodie", "google"],
  ["port", "example.com:8080", "google"]
];
const ITERATIONS = 2000;
test("search resolver latency benchmark (informational, not a release gate)", () => {
  const samples = [];
  for (const [name, input, provider] of CASES) {
    for (let i = 0; i < 200; i++) resolveHerculesInput(input, provider);
    const times = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      const output = resolveHerculesInput(input, provider);
      assert.ok(output.startsWith("https://"));
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p = q => times[Math.min(times.length - 1, Math.floor(q * times.length))];
    samples.push({case: name, count: ITERATIONS, medianMs: p(0.5), p95Ms: p(0.95), p99Ms: p(0.99)});
  }
  console.log("HERCULES_RESOLVER_BENCHMARK " + JSON.stringify({node: process.version, cases: samples}));
  assert.equal(samples.length, CASES.length);
});
