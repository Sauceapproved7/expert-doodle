export const MODEL_PLANE_VERSION = "0.1";

export const MODEL_TASKS = Object.freeze([
  "general",
  "code",
  "vision",
  "speech-to-text",
  "text-to-speech",
  "research",
  "agent",
  "embedding",
  "rerank",
  "safety",
]);

export const MODEL_STATES = Object.freeze([
  "planned",
  "development",
  "candidate",
  "active",
  "retired",
]);

export const MODEL_ORIGINS = Object.freeze([
  "hercules-native",
  "hercules-trained",
  "open-weight",
  "external",
]);

const IDENT = /^[a-z][a-z0-9-]{1,63}$/;
const TASK_SET = new Set(MODEL_TASKS);
const STATE_SET = new Set(MODEL_STATES);
const ORIGIN_SET = new Set(MODEL_ORIGINS);

function normalizeRuntime(runtime) {
  if (runtime == null) return null;
  return {
    kind: String(runtime.kind ?? "").trim(),
    endpoint: runtime.endpoint == null ? null : String(runtime.endpoint).trim(),
  };
}

export function normalizeModelManifest(input = {}) {
  return {
    version: input.version ?? MODEL_PLANE_VERSION,
    id: String(input.id ?? "").trim(),
    family: String(input.family ?? "").trim(),
    description: String(input.description ?? "").trim(),
    tasks: Array.isArray(input.tasks) ? [...new Set(input.tasks.map(String))] : [],
    state: input.state ?? "planned",
    origin: input.origin ?? "hercules-native",
    priority: Number.isInteger(input.priority) ? input.priority : 0,
    checkpoint: input.checkpoint == null ? null : String(input.checkpoint).trim(),
    runtime: normalizeRuntime(input.runtime),
    provenance: input.provenance == null ? null : String(input.provenance).trim(),
  };
}

export function validateModelManifest(input) {
  const model = normalizeModelManifest(input);
  const errors = [];

  if (model.version !== MODEL_PLANE_VERSION) errors.push("unsupported model manifest version");
  if (!IDENT.test(model.id)) errors.push("id must be a stable lowercase identifier");
  if (!IDENT.test(model.family)) errors.push("family must be a stable lowercase identifier");
  if (!model.description) errors.push("description is required");
  if (model.tasks.length === 0) errors.push("at least one task is required");

  for (const task of model.tasks) {
    if (!TASK_SET.has(task)) errors.push("unsupported task: " + task);
  }

  if (!STATE_SET.has(model.state)) errors.push("unsupported state: " + model.state);
  if (!ORIGIN_SET.has(model.origin)) errors.push("unsupported origin: " + model.origin);

  if (!Number.isInteger(model.priority) || model.priority < 0 || model.priority > 1000) {
    errors.push("priority must be an integer from 0 to 1000");
  }

  if (model.state === "active" && !model.runtime) {
    errors.push("active models require a runtime");
  }

  if (model.runtime) {
    if (!["http", "embedded"].includes(model.runtime.kind)) {
      errors.push("runtime.kind must be http or embedded");
    }

    if (model.runtime.kind === "http") {
      if (!model.runtime.endpoint) {
        errors.push("http runtime requires endpoint");
      } else {
        try {
          const url = new URL(model.runtime.endpoint);
          if (!["http:", "https:"].includes(url.protocol)) {
            errors.push("http runtime endpoint must use http or https");
          }
          if (url.username || url.password) {
            errors.push("runtime endpoint must not embed credentials");
          }
        } catch {
          errors.push("runtime endpoint must be a valid URL");
        }
      }
    }
  }

  return {ok: errors.length === 0, errors, model};
}
