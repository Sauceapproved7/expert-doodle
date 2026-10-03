import {validateForgeSpec} from "./schema.mjs";

export class ForgeInterpreter {
  async interpret() {
    throw new Error("ForgeInterpreter.interpret must be implemented by a replaceable adapter");
  }
}

export class StaticForgeInterpreter extends ForgeInterpreter {
  constructor(spec) {
    super();
    this.spec = spec;
  }

  async interpret() {
    return structuredClone(this.spec);
  }
}

function validateHttpEndpoint(endpoint, label = "interpreter endpoint") {
  if (!endpoint) throw new TypeError(label + " is required");
  const parsed = new URL(endpoint);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new TypeError(label + " must use http or https");
  }
  if (parsed.username || parsed.password) {
    throw new TypeError(label + " must not embed credentials");
  }
  return parsed.toString();
}

function assertInterpreterLimits({timeoutMs, maxResponseBytes}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300000) {
    throw new TypeError("timeoutMs must be between 1 and 300000");
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new TypeError("maxResponseBytes must be a positive integer");
  }
}

async function boundedResponseText(response, maxResponseBytes) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    throw new Error("interpreter response too large");
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > maxResponseBytes) {
    throw new Error("interpreter response too large");
  }
  return text;
}

function parseJson(text, errorMessage) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(errorMessage);
  }
}

function cleanModelJson(value) {
  const raw = String(value ?? "").trim();
  const fenced = raw.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i);
  return (fenced ? fenced[1] : raw).trim();
}

function normalizeSafeForgeMetadata(spec) {
  const next=structuredClone(spec);
  if (next.version === undefined || next.version === null || next.version === "") {
    next.version="0.1";
  }
  if (!String(next.name ?? "").trim()) {
    const firstEntity=Array.isArray(next.entities) ? String(next.entities[0]?.name ?? "").trim() : "";
    next.name=/^[A-Za-z][A-Za-z0-9_-]{0,59}$/.test(firstEntity)
      ? (firstEntity+"App").slice(0,64)
      : "GeneratedApp";
  }
  if (!String(next.description ?? "").trim()) {
    next.description="Generated from the approved Forge prompt.";
  }
  return next;
}

const HERCULES_FORGE_SPEC_SYSTEM = [
  "You are the Hercules Forge specification interpreter.",
  "Translate the user's product request into exactly one JSON object matching the canonical Forge spec.",
  "Before mapping to the spec, interpret the request through six semantic dimensions: GOAL, CONTEXT, CONSTRAINTS, ACTION, OUTPUT, and VERIFICATION.",
  "GOAL is the product outcome; CONTEXT is supplied domain/background; CONSTRAINTS are explicit limits; ACTION is requested behavior; OUTPUT is the requested application shape; VERIFICATION is user-stated acceptance evidence.",
  "Treat these dimensions as interpretation aids only. Never invent a missing dimension, never weaken an explicit constraint, and never convert verification language into execution authority.",
  "Return JSON only. Do not return markdown, explanations, code, credentials, secrets, SQL, shell commands, or deployment claims.",
  'Required top-level shape: {"version":"0.1","name":"StableIdentifier","description":"...","entities":[],"pages":[],"actions":[]}.',
  "Entity fields: {name,type,required?}; allowed field types: string, number, boolean, datetime, json.",
  "Page kinds: list, detail, form, dashboard. A page entity must reference a declared entity.",
  "Action kinds: create, read, update, delete, custom. An action entity must reference a declared entity.",
  "Names must start with a letter and contain only letters, digits, underscore, or hyphen; keep names stable and concise.",
  "Do not invent integrations, permissions, credentials, or external capabilities. Describe only the requested application structure.",
].join("\n");

export class HttpForgeInterpreter extends ForgeInterpreter {
  constructor({
    endpoint,
    token = null,
    timeoutMs = 30000,
    maxResponseBytes = 1024 * 1024,
    fetchImpl = globalThis.fetch,
  }) {
    super();
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    assertInterpreterLimits({timeoutMs, maxResponseBytes});

    this.endpoint = validateHttpEndpoint(endpoint);
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.fetchImpl = fetchImpl;
  }

  async interpret(prompt) {
    if (typeof prompt !== "string" || !prompt.trim()) {
      throw new TypeError("prompt must be a non-empty string");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers = {"content-type": "application/json"};
      if (this.token) headers.authorization = "Bearer " + this.token;

      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers,
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
        body: JSON.stringify({
          protocol: "hercules-forge-interpreter/0.1",
          prompt: prompt.trim(),
          output: "forge-spec",
          specVersion: "0.1",
        }),
      });

      if (!response.ok) {
        throw new Error("interpreter request failed with status " + response.status);
      }

      const text = await boundedResponseText(response, this.maxResponseBytes);
      const body = parseJson(text, "interpreter returned invalid JSON");
      const spec = body?.spec ?? body;
      if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
        throw new Error("interpreter did not return a Forge spec object");
      }
      return spec;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class HerculesAiForgeInterpreter extends ForgeInterpreter {
  constructor({
    endpoint,
    internalKey,
    timeoutMs = 45000,
    maxResponseBytes = 1024 * 1024,
    fetchImpl = globalThis.fetch,
  }) {
    super();
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    assertInterpreterLimits({timeoutMs, maxResponseBytes});
    if (typeof internalKey !== "string" || internalKey.length < 32) {
      throw new TypeError("Hercules AI internal key must be at least 32 characters");
    }

    this.endpoint = validateHttpEndpoint(endpoint, "Hercules AI interpreter endpoint");
    this.internalKey = internalKey;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.fetchImpl = fetchImpl;
  }

  async interpret(prompt) {
    if (typeof prompt !== "string" || !prompt.trim()) {
      throw new TypeError("prompt must be a non-empty string");
    }
    const originalPrompt = prompt.trim();

    const requestModelSpec = async (modelPrompt) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-hercules-internal-key": this.internalKey,
          },
          signal: controller.signal,
          redirect: "error",
          cache: "no-store",
          body: JSON.stringify({
            action: "route_internal",
            system: HERCULES_FORGE_SPEC_SYSTEM,
            prompt: modelPrompt,
          }),
        });

        if (!response.ok) {
          throw new Error("Hercules AI interpreter request failed with status " + response.status);
        }

        const text = await boundedResponseText(response, this.maxResponseBytes);
        const body = parseJson(text, "Hercules AI interpreter returned invalid JSON");
        if (body?.ok !== true || typeof body?.result !== "string") {
          throw new Error("Hercules AI interpreter did not return model output");
        }

        const spec = parseJson(
          cleanModelJson(body.result),
          "Hercules AI interpreter returned invalid JSON",
        );
        if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
          throw new Error("Hercules AI interpreter did not return a Forge spec object");
        }
        return spec;
      } finally {
        clearTimeout(timer);
      }
    };

    const firstSpec = await requestModelSpec(originalPrompt);
    const normalizedFirstSpec = normalizeSafeForgeMetadata(firstSpec);
    const firstValidation = validateForgeSpec(normalizedFirstSpec);
    if (firstValidation.ok) return firstValidation.spec;

    const repairPrompt = [
      "Repair the previous Forge specification by regenerating the complete canonical Forge spec.",
      "Return JSON only and obey the Forge specification system instructions.",
      "Do not discuss the errors or add capabilities that were not requested.",
      "Original product request:",
      originalPrompt,
      "Validator errors:",
      ...firstValidation.errors.map((error) => "- " + error),
    ].join("\n");

    const repairedSpec = await requestModelSpec(repairPrompt);
    const repairedValidation = validateForgeSpec(repairedSpec);
    if (!repairedValidation.ok) {
      throw new Error(
        "Hercules AI interpreter returned invalid Forge spec: " +
        repairedValidation.errors.join("; "),
      );
    }
    return repairedValidation.spec;
  }
}

export const HERCULES_FORGE_SPEC_INTERPRETER_SYSTEM = HERCULES_FORGE_SPEC_SYSTEM;
