import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  DEVBRAIN_BROWSER_PROBE_URL,
  buildDevBrainBrowserProbe,
  evaluateDevBrainBrowserProbe,
} from "../supabase/functions/hercules-devbrain-fabric/browser-check.mjs";

test("DevBrain browser probe uses a stable public URL and no arbitrary steps", () => {
  const probe = buildDevBrainBrowserProbe();
  assert.equal(probe.action, "scrape");
  assert.equal(probe.url, "https://example.com/");
  assert.equal(probe.url, DEVBRAIN_BROWSER_PROBE_URL);
  assert.deepEqual(probe.steps, []);
  assert.equal(probe.maxTextChars, 2000);
});

test("DevBrain browser probe passes only verified Hercules Browser success", () => {
  const passed = evaluateDevBrainBrowserProbe(200, {
    ok: true,
    traceId: "trace-1",
    result: {
      page: {
        url: "https://example.com/",
        title: "Example Domain",
      },
    },
  });
  assert.equal(passed.ok, true);
  assert.equal(passed.traceId, "trace-1");
  assert.equal(passed.pageUrl, "https://example.com/");
});

test("DevBrain browser probe rejects HTTP or Hercules Browser failures", () => {
  assert.equal(evaluateDevBrainBrowserProbe(502, {ok:false}).ok, false);
  assert.equal(evaluateDevBrainBrowserProbe(200, {ok:false}).ok, false);
  assert.equal(evaluateDevBrainBrowserProbe(200, {ok:true}).ok, false);
});

test("operator bridge preserves server-only Hercules Browser credential custody", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20260927033800_hercules_browser_operator_bridge_v1.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(sql, /purpose = 'browser-gateway'/);
  assert.match(sql, /hercules_get_secret/);
  assert.match(sql, /functions\/v1\/hercules-browser/);
  assert.match(sql, /grant execute on function public\.hercules_browser_submit\(jsonb\) to service_role/i);
  assert.match(sql, /revoke all on function public\.hercules_browser_submit\(jsonb\) from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /Bearer\s+[A-Za-z0-9_-]{20,}/);
});
