import {HerculesVideoAdapter} from "./adapter.mjs";
import {createRenderRequest} from "./render-bridge.mjs";

function assertSelfHostedTarget(target) {
  if (!target || typeof target !== "object") throw new Error("self_hosted_target_required");
  if (target.kind !== "self-hosted") throw new Error("self_hosted_target_kind_required");
  if (!String(target.runtimeId || "").trim()) throw new Error("self_hosted_runtime_id_required");
  return Object.freeze({
    kind: "self-hosted",
    runtimeId: String(target.runtimeId),
    endpoint: target.endpoint ? String(target.endpoint) : null,
  });
}

function assertTransport(transport) {
  for (const method of ["health", "estimate", "submit", "status", "inspect"]) {
    if (typeof transport?.[method] !== "function") throw new Error("self_hosted_transport_invalid:" + method);
  }
  return transport;
}

export class HerculesSelfHostedRenderAdapter extends HerculesVideoAdapter {
  constructor({id = "hercules-self-hosted", label = "Hercules Self-Hosted", target, transport}) {
    const normalizedTarget = assertSelfHostedTarget(target);
    super({
      id,
      label,
      kind: "self-hosted",
      runtimeId: normalizedTarget.runtimeId,
    });
    this.target = normalizedTarget;
    this.transport = assertTransport(transport);
  }

  async health() {
    return this.transport.health({target: this.target});
  }

  async estimate(request) {
    return this.transport.estimate({
      target: this.target,
      request: this.#toEnvelope(request),
    });
  }

  async generate(request) {
    return this.transport.submit({
      target: this.target,
      request: this.#toEnvelope(request),
    });
  }

  async inspect(asset) {
    return this.transport.inspect({target: this.target, asset});
  }

  async status(remoteJobId) {
    if (!String(remoteJobId || "").trim()) throw new Error("remote_job_id_required");
    return this.transport.status({target: this.target, remoteJobId: String(remoteJobId)});
  }

  #toEnvelope(request) {
    if (!request?.requestFingerprint) throw new Error("render_request_fingerprint_required");
    return {
      schema: "sauceapproved.hercules.video-selfhosted-envelope",
      version: 1,
      runtimeId: this.target.runtimeId,
      request,
    };
  }
}

export function createSelfHostedRenderRequest(input) {
  return createRenderRequest(input);
}
