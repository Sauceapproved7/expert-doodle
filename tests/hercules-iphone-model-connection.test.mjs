import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const html = readFileSync(new URL("../hercules-ai/ui/index.html", import.meta.url), "utf8");
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "Hercules inline controller exists");

function boot(fetcher) {
  const elements = new Map();
  for (const id of ["speedMode", "speedReadout", "chatLog", "chatInput", "chatSend", "modelStatus", "modelRetry"]) {
    elements.set(id, {
      id, value: "", textContent: "", disabled: false, events: {},
      addEventListener(name, callback) { this.events[name] = callback; },
      focus() {},
    });
  }
  const document = {getElementById: id => elements.get(id)};
  runInNewContext(source, {document, window: {}, navigator: {}, fetch: fetcher, TextDecoder});
  return {
    element: id => elements.get(id),
    event: (id, name) => elements.get(id).events[name](),
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test("iPhone chat displays a meaningful, accessible model connection state", () => {
  assert.match(html, /id="modelStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="modelRetry"/);
});

test("a failed public inventory check disables chat and displays offline state", async () => {
  const called = [];
  const ui = boot(async path => {
    called.push(path);
    return {ok: false, status: 502};
  });
  assert.equal(ui.element("chatSend").disabled, true, "chat starts fail-closed");
  await tick();
  assert.deepEqual(called, ["/v1/models"]);
  assert.equal(ui.element("chatSend").disabled, true);
  assert.match(ui.element("modelStatus").textContent, /unavailable/i);
  assert.equal(ui.element("modelRetry").disabled, false);
  await ui.event("chatSend", "click");
  assert.deepEqual(called, ["/v1/models"], "blocked chat never posts a request");
});

test("invalid or empty model inventory cannot enable iPhone chat", async () => {
  const ui = boot(async () => ({ok: true, json: async () => ({count: 1, installed: []})}));
  await tick();
  assert.equal(ui.element("chatSend").disabled, true);
  assert.match(ui.element("modelStatus").textContent, /unavailable/i);
});

test("valid model inventory enables chat without claiming a verified conversation", async () => {
  const ui = boot(async (path, options) => {
    assert.equal(path, "/v1/models");
    assert.equal(options.cache, "no-store");
    return {ok: true, json: async () => ({count: 1, installed: [{name: "hercules-core"}]})};
  });
  await tick();
  assert.equal(ui.element("chatSend").disabled, false);
  assert.match(ui.element("modelStatus").textContent, /model detected/i);
  assert.doesNotMatch(ui.element("modelStatus").textContent, /chat verified|production ready/i);
});

test("retry can restore a lost model connection without a page reload", async () => {
  let ready = false;
  let calls = 0;
  const ui = boot(async () => {
    calls += 1;
    return ready ? {ok: true, json: async () => ({count: 1, installed: [{name: "local"}]})} : {ok: false, status: 502};
  });
  await tick();
  assert.equal(ui.element("chatSend").disabled, true);
  ready = true;
  await ui.event("modelRetry", "click");
  await tick();
  assert.equal(calls, 2);
  assert.equal(ui.element("chatSend").disabled, false);
});

test("model inventory network exception remains fail-closed", async () => {
  const ui = boot(async () => {throw Error("private error detail");});
  await tick();
  assert.equal(ui.element("chatSend").disabled, true);
  assert.doesNotMatch(ui.element("modelStatus").textContent, /private error detail/);
});
