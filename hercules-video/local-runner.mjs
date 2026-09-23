export class HerculesLocalVideoRunner {
  constructor(descriptor = {}) {
    if (!String(descriptor.id || "").trim()) throw new Error("local_runner_id_required");
    this.descriptor = Object.freeze({
      id: String(descriptor.id),
      label: String(descriptor.label || descriptor.id),
      modelFamily: descriptor.modelFamily ? String(descriptor.modelFamily) : null,
      nativeAudio: descriptor.nativeAudio === true,
    });
  }

  async health() {
    return {ok: true, runnerId: this.descriptor.id};
  }

  async estimate(_request) {
    return {supported: true, estimatedSeconds: null};
  }

  async render(_request) {
    throw new Error("local_runner_render_not_implemented");
  }
}

export function assertLocalVideoRunner(runner) {
  for (const method of ["health", "estimate", "render"]) {
    if (typeof runner?.[method] !== "function") throw new Error("local_runner_invalid:" + method);
  }
  if (!String(runner?.descriptor?.id || "").trim()) throw new Error("local_runner_descriptor_required");
  return true;
}
