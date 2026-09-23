const STATE_BY_MODE = Object.freeze({
  production: new Set(["active"]),
  evaluation: new Set(["active", "candidate"]),
  development: new Set(["active", "candidate", "development"]),
});

const ORIGIN_RANK = Object.freeze({
  "hercules-native": 4,
  "hercules-trained": 3,
  "open-weight": 2,
  external: 1,
});

function isRouteable(model) {
  if (!model.runtime) return false;
  if (model.runtime.kind === "http") return Boolean(model.runtime.endpoint);
  return model.runtime.kind === "embedded";
}

export class HerculesModelRouter {
  constructor(registry, {nativeOnly = true} = {}) {
    if (!registry || typeof registry.list !== "function") {
      throw new TypeError("registry with list() is required");
    }
    this.registry = registry;
    this.nativeOnly = nativeOnly;
  }

  route({task, mode = "production", modelId = null} = {}) {
    if (!task) throw new TypeError("task is required");
    const allowedStates = STATE_BY_MODE[mode];
    if (!allowedStates) throw new TypeError("unsupported routing mode: " + mode);

    if (modelId) {
      const model = this.registry.require(modelId);
      if (!model.tasks.includes(task)) throw new Error("model does not support task: " + task);
      if (!allowedStates.has(model.state)) throw new Error("model is not eligible in mode: " + mode);
      if (this.nativeOnly && !model.origin.startsWith("hercules-")) {
        throw new Error("native-only policy rejected model: " + model.id);
      }
      if (!isRouteable(model)) throw new Error("model has no routeable runtime: " + model.id);
      return model;
    }

    const candidates = this.registry
      .list({task})
      .filter((model) => allowedStates.has(model.state))
      .filter(isRouteable)
      .filter((model) => !this.nativeOnly || model.origin.startsWith("hercules-"))
      .sort((a, b) => {
        const origin = (ORIGIN_RANK[b.origin] ?? 0) - (ORIGIN_RANK[a.origin] ?? 0);
        if (origin) return origin;
        const priority = b.priority - a.priority;
        if (priority) return priority;
        return a.id.localeCompare(b.id);
      });

    if (candidates.length === 0) {
      throw new Error("no eligible Hercules model for task: " + task);
    }
    return candidates[0];
  }
}
