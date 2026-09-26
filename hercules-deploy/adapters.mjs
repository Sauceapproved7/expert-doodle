export class HerculesDeployTargetAdapter {
  async deploy() {
    throw new Error("HerculesDeployTargetAdapter.deploy must be implemented");
  }

  async verify() {
    throw new Error("HerculesDeployTargetAdapter.verify must be implemented");
  }

  async rollback() {
    throw new Error("HerculesDeployTargetAdapter.rollback must be implemented");
  }
}

export class MemoryHerculesDeployTargetAdapter extends HerculesDeployTargetAdapter {
  constructor() {
    super();
    this.services = new Map();
  }

  async deploy({deploymentId, request}) {
    this.services.set(request.serviceId, {
      deploymentId,
      releaseId: request.releaseId,
      sourceCommit: request.sourceCommit,
      artifactFingerprint: request.artifactFingerprint,
      publicOrigin: request.publicOrigin,
    });
    return {
      targetKind: request.target.kind,
      targetReference: request.target.reference,
      releaseId: request.releaseId,
    };
  }

  async verify({deploymentId, request}) {
    const current = this.services.get(request.serviceId);
    if (!current || current.deploymentId !== deploymentId) {
      throw Object.assign(new Error("deployment not active"), {code: "deployment_not_active"});
    }
    return {
      verified: true,
      releaseId: request.releaseId,
      sourceCommit: request.sourceCommit,
      artifactFingerprint: request.artifactFingerprint,
      publicOrigin: request.publicOrigin,
    };
  }

  async rollback({deploymentId, request}) {
    const current = this.services.get(request.serviceId);
    if (current?.deploymentId === deploymentId) this.services.delete(request.serviceId);
    return {
      rolledBack: true,
      releaseId: request.releaseId,
    };
  }
}
