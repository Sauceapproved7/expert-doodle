import assert from "node:assert/strict";
import test from "node:test";
import {createRenderRequest, sha256Bytes} from "../hercules-video/render-bridge.mjs";
import {HerculesSelfHostedRenderAdapter} from "../hercules-video/self-hosted-adapter.mjs";
import {HerculesLocalVideoRunner} from "../hercules-video/local-runner.mjs";
import {HerculesLocalVideoRuntime} from "../hercules-video/local-runtime.mjs";
import {createHerculesVideoHttpServer} from "../hercules-video/local-http-server.mjs";

const shot = {
  id:"launch-local-01",
  prompt:"Hercules verification interface resolves to a clean proof state",
  durationSeconds:4,
  aspectRatio:"9:16",
};

class FakeRunner extends HerculesLocalVideoRunner {
  constructor() {
    super({id:"fake-local",label:"Fake Local",modelFamily:"test"});
    this.calls = 0;
  }
  async estimate() {
    return {supported:true,estimatedSeconds:1};
  }
  async render(request) {
    this.calls += 1;
    const bytes = Buffer.from("fake-video:" + request.requestFingerprint);
    return {
      artifact:{
        uri:"file:///tmp/" + request.shot.id + ".mp4",
        mimeType:"video/mp4",
        sizeBytes:bytes.length,
        sha256:sha256Bytes(bytes),
      }
    };
  }
}

function createStack() {
  const runner = new FakeRunner();
  const runtime = new HerculesLocalVideoRuntime({runtimeId:"hercules-test-runtime",runner});
  const adapter = new HerculesSelfHostedRenderAdapter({
    target:{kind:"self-hosted",runtimeId:"hercules-test-runtime",endpoint:"http://127.0.0.1:0"},
    transport:runtime,
  });
  return {runner,runtime,adapter};
}

test("local runtime completes a generic Hercules render job", async () => {
  const {runtime,adapter} = createStack();
  const request = createRenderRequest({projectId:"launch",shot});
  const submitted = await adapter.generate(request);
  assert.equal(submitted.status, "queued");
  await runtime.drain();
  const status = await adapter.status(submitted.remoteJobId);
  assert.equal(status.status, "completed");
  assert.match(status.artifact.sha256, /^[a-f0-9]{64}$/);
});

test("local runtime deduplicates the same in-flight or completed request", async () => {
  const {runner,runtime,adapter} = createStack();
  const request = createRenderRequest({projectId:"launch",shot});
  const first = await adapter.generate(request);
  const second = await adapter.generate(request);
  assert.equal(second.remoteJobId, first.remoteJobId);
  assert.equal(second.reused, true);
  await runtime.drain();
  assert.equal(runner.calls, 1);
});

test("runtime rejects a modified request whose fingerprint no longer matches", async () => {
  const {adapter} = createStack();
  const request = createRenderRequest({projectId:"launch",shot});
  request.shot.prompt = "tampered";
  await assert.rejects(() => adapter.generate(request), /runtime_request_fingerprint_mismatch/);
});

test("HTTP runtime binds only to loopback", () => {
  const {runtime} = createStack();
  assert.throws(() => createHerculesVideoHttpServer({runtime,host:"0.0.0.0"}), /http_loopback_host_required/);
});

test("HTTP runtime exposes health, submit, and status locally", async () => {
  const {runtime} = createStack();
  const service = createHerculesVideoHttpServer({runtime,host:"127.0.0.1",port:0});
  const address = await service.listen();
  try {
    const health = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(health.status, 200);
    const request = createRenderRequest({projectId:"launch",shot});
    const envelope = {
      schema:"sauceapproved.hercules.video-selfhosted-envelope",
      version:1,
      runtimeId:"hercules-test-runtime",
      request,
    };
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/render`,{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(envelope),
    });
    assert.equal(response.status, 202);
    const submitted = await response.json();
    await runtime.drain();
    const status = await fetch(`http://127.0.0.1:${address.port}/v1/jobs/${submitted.remoteJobId}`);
    assert.equal(status.status, 200);
    const body = await status.json();
    assert.equal(body.status, "completed");
  } finally {
    await service.close();
  }
});
