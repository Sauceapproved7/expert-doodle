import assert from "node:assert/strict";
import test from "node:test";
import {
  createRenderJob,
  createRenderRequest,
  failTimedOutRenderJob,
  recordRenderArtifact,
  renderJobTimedOut,
  scheduleRenderRetry,
  sha256Bytes,
  transitionRenderJob,
} from "../hercules-video/render-bridge.mjs";
import {HerculesSelfHostedRenderAdapter} from "../hercules-video/self-hosted-adapter.mjs";

const shot = {
  id: "launch-01",
  prompt: "Premium dark Hercules system verifying a deployment",
  durationSeconds: 5,
  aspectRatio: "9:16",
  requiresAudio: true,
};

test("render request is deterministic and provider-neutral", () => {
  const input = {projectId:"launch", shot, resolution:"1080p", fps:24, modelRef:"local/model-v1"};
  const a = createRenderRequest(input);
  const b = createRenderRequest(input);
  assert.equal(a.requestFingerprint, b.requestFingerprint);
  assert.equal(a.output.resolution, "1080p");
  assert.equal("provider" in a, false);
});

test("render job lifecycle is fail closed", () => {
  const request = createRenderRequest({projectId:"launch", shot});
  const queued = createRenderJob(request, {now:"2026-09-23T00:00:00Z", timeoutMs:1000, maxAttempts:2});
  const running = transitionRenderJob(queued, "running", {now:"2026-09-23T00:00:01Z"});
  assert.equal(running.attempt, 1);
  assert.throws(() => transitionRenderJob(running, "queued"), /render_transition_invalid/);
  assert.throws(() => transitionRenderJob(running, "completed"), /render_artifact_required/);
});

test("timeout becomes retryable failure and exponential retry remains bounded", () => {
  const request = createRenderRequest({projectId:"launch", shot});
  let job = createRenderJob(request, {now:"2026-09-23T00:00:00Z", timeoutMs:1000, maxAttempts:3});
  job = transitionRenderJob(job, "running", {now:"2026-09-23T00:00:00Z"});
  assert.equal(renderJobTimedOut(job, "2026-09-23T00:00:01Z"), true);
  job = failTimedOutRenderJob(job, "2026-09-23T00:00:01Z");
  assert.equal(job.status, "failed");
  assert.equal(job.error.retryable, true);
  job = scheduleRenderRetry(job, {now:"2026-09-23T00:00:01Z",baseDelayMs:5000,maxDelayMs:10000});
  assert.equal(job.status, "queued");
  assert.equal(job.retryAt, "2026-09-23T00:00:06.000Z");
});

test("artifact captures verified checksum and metadata", () => {
  const bytes = Buffer.from("hercules-video-test");
  const artifact = recordRenderArtifact({
    uri:"file:///renders/launch-01.mp4",
    mimeType:"video/mp4",
    sizeBytes:bytes.length,
    bytes,
    width:1080,
    height:1920,
    durationSeconds:5,
  });
  assert.equal(artifact.sha256, sha256Bytes(bytes));
  assert.match(artifact.artifactFingerprint, /^[a-f0-9]{64}$/);
});

test("completed render requires recorded artifact", () => {
  const request = createRenderRequest({projectId:"launch", shot});
  let job = createRenderJob(request, {now:"2026-09-23T00:00:00Z"});
  job = transitionRenderJob(job, "running", {now:"2026-09-23T00:00:01Z"});
  const bytes = Buffer.from("render");
  const artifact = recordRenderArtifact({uri:"file:///render.mp4",sizeBytes:bytes.length,bytes});
  job = transitionRenderJob(job, "completed", {now:"2026-09-23T00:00:03Z", artifact});
  assert.equal(job.status, "completed");
  assert.equal(job.artifact.sha256, sha256Bytes(bytes));
});

test("self-hosted adapter accepts only Hercules self-hosted target contract", async () => {
  const calls = [];
  const transport = {
    async health(input){ calls.push(["health", input]); return {ok:true}; },
    async estimate(input){ calls.push(["estimate", input]); return {estimatedSeconds:5}; },
    async submit(input){ calls.push(["submit", input]); return {remoteJobId:"local-1"}; },
    async status(input){ calls.push(["status", input]); return {status:"running"}; },
    async inspect(input){ calls.push(["inspect", input]); return {ok:true}; },
  };
  assert.throws(() => new HerculesSelfHostedRenderAdapter({
    target:{kind:"commercial",runtimeId:"x"},
    transport,
  }), /self_hosted_target_kind_required/);

  const adapter = new HerculesSelfHostedRenderAdapter({
    target:{kind:"self-hosted",runtimeId:"hercules-gpu-01",endpoint:"http://127.0.0.1:8090"},
    transport,
  });
  const request = createRenderRequest({projectId:"launch", shot});
  const result = await adapter.generate(request);
  assert.equal(result.remoteJobId, "local-1");
  assert.equal(calls[0][1].request.schema, "sauceapproved.hercules.video-selfhosted-envelope");
  assert.equal(calls[0][1].request.request.requestFingerprint, request.requestFingerprint);
});
