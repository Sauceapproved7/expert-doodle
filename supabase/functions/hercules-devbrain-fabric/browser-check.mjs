export const DEVBRAIN_BROWSER_PROBE_URL = "https://example.com/";

export function buildDevBrainBrowserProbe() {
  return Object.freeze({
    action: "scrape",
    url: DEVBRAIN_BROWSER_PROBE_URL,
    timeoutMs: 30000,
    maxTextChars: 2000,
    steps: [],
  });
}

export function evaluateDevBrainBrowserProbe(status, payload) {
  const ok =
    Number(status) >= 200 &&
    Number(status) < 300 &&
    payload?.ok === true &&
    payload?.result &&
    typeof payload.result === "object";

  return Object.freeze({
    ok,
    status: Number(status) || 0,
    traceId: payload?.traceId || null,
    pageUrl: payload?.result?.page?.url || null,
    title: payload?.result?.page?.title || null,
  });
}
