function safeErrorCode(error, fallback) {
  const code = String(error?.code ?? "");
  return /^[a-z][a-z0-9_.-]{0,127}$/.test(code) ? code : fallback;
}

export class HerculesDeployWorker {
  constructor({store, adapters = new Map(), admissionGate = null, pollIntervalMs = 1000} = {}) {
    if (!store) throw new TypeError("store is required");
    if (!(adapters instanceof Map)) throw new TypeError("adapters must be a Map");\n    if (admissionGate != null && typeof admissionGate.admit !== "function") {\n      throw new TypeError("admissionGate must expose admit()");\n    }
    if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 100 || pollIntervalMs > 60000) {
      throw new TypeError("pollIntervalMs must be between 100 and 60000");
    }
    this.store = store;
    this.adapters = adapters;
    this.pollIntervalMs = pollIntervalMs;
    this.timer = null;
    this.stopped = true;
    this.tickRunning = false;
  }

  adapterFor(request) {
    const adapter = this.adapters.get(request.target.kind);
    if (!adapter) {
      throw Object.assign(new Error("target adapter unavailable"), {
        code: "target_adapter_unavailable",
      });
    }
    return adapter;
  }

  async process(deploymentId) {
    let deployment = await this.store.get(deploymentId);
    if (deployment.state.status !== "queued") {
      throw Object.assign(new Error("deployment is not queued"), {statusCode: 409});
    }

    await this.store.transition(deploymentId, "running");
    deployment = await this.store.get(deploymentId);
    let adapter;
    try {
      adapter = this.adapterFor(deployment.request);
      const deployEvidence = await adapter.deploy(deployment);
      await this.store.transition(deploymentId, "verifying", {deployEvidence});

      deployment = await this.store.get(deploymentId);
      const verificationEvidence = await adapter.verify(deployment);
      await this.store.transition(deploymentId, "verified", {verificationEvidence});
      return this.store.get(deploymentId);
    } catch (error) {
      const current = await this.store.get(deploymentId);
      if (current.state.status === "running" || current.state.status === "verifying") {
        await this.store.transition(deploymentId, "failed", {
          errorCode: safeErrorCode(
            error,
            current.state.status === "verifying"
              ? "target_verification_failed"
              : "target_deploy_failed",
          ),
        });
      }
      throw error;
    }
  }

  async rollback(deploymentId) {
    let deployment = await this.store.get(deploymentId);
    if (deployment.state.status !== "verified") {
      throw Object.assign(new Error("deployment is not verified"), {statusCode: 409});
    }
    const adapter = this.adapterFor(deployment.request);
    await this.store.transition(deploymentId, "rolling_back");

    try {
      deployment = await this.store.get(deploymentId);
      const rollbackEvidence = await adapter.rollback(deployment);
      await this.store.transition(deploymentId, "rolled_back", {rollbackEvidence});
      return this.store.get(deploymentId);
    } catch (error) {
      await this.store.transition(deploymentId, "failed", {
        errorCode: safeErrorCode(error, "target_rollback_failed"),
      });
      throw error;
    }
  }

  async retry(deploymentId) {
    await this.store.requeue(deploymentId);
    return this.store.get(deploymentId);
  }

  async runOnce() {
    const queued = await this.store.list({status: "queued", limit: 1});
    if (!queued.length) return null;
    return this.process(queued[0].deploymentId);
  }

  async tick() {
    if (this.tickRunning || this.stopped) return;
    this.tickRunning = true;
    try {
      await this.runOnce();
    } catch {
      // Failed deployments are persisted by process(); the loop continues.
    } finally {
      this.tickRunning = false;
    }
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
