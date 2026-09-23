export class HerculesVideoAdapter {
  constructor(descriptor) {
    if (!descriptor?.id) throw new Error("adapter_id_required");
    this.descriptor = Object.freeze({...descriptor});
  }

  async health() {
    throw new Error("adapter_health_not_implemented");
  }

  async estimate(_request) {
    throw new Error("adapter_estimate_not_implemented");
  }

  async generate(_request) {
    throw new Error("adapter_generate_not_implemented");
  }

  async inspect(_asset) {
    throw new Error("adapter_inspect_not_implemented");
  }
}

export function assertAdapterBoundary(adapter) {
  const methods = ["health", "estimate", "generate", "inspect"];
  for (const method of methods) {
    if (typeof adapter?.[method] !== "function") throw new Error("adapter_boundary_invalid:" + method);
  }
  return true;
}
