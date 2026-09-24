import {createHash} from "node:crypto";
import {appendFile, mkdir, readFile} from "node:fs/promises";
import {dirname, join} from "node:path";

const AUDIT_VERSION = 1;
const EVENT_TYPE = /^[a-z][a-z0-9._-]{1,127}$/;
const OUTCOMES = new Set(["success", "failure", "blocked"]);
const FORBIDDEN_DETAIL_KEY = /(password|token|secret|authorization|cookie|csrf)/i;
const MAX_EVENT_BYTES = 16 * 1024;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function validateIdentifier(label, value, {required = false} = {}) {
  if (value == null || value === "") {
    if (required) throw new TypeError(label + " is required");
    return null;
  }
  const normalized = String(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,191}$/.test(normalized)) {
    throw new TypeError(label + " contains unsafe characters");
  }
  return normalized;
}

function validateSecretFree(value, path = "details", depth = 0) {
  if (depth > 8) throw new TypeError("audit details nesting is too deep");
  if (value == null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("audit details numbers must be finite");
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 100) throw new TypeError("audit details arrays are too large");
    value.forEach((entry, index) => validateSecretFree(entry, path + "[" + index + "]", depth + 1));
    return;
  }
  if (typeof value !== "object") throw new TypeError("audit details must be JSON-compatible");
  const entries = Object.entries(value);
  if (entries.length > 100) throw new TypeError("audit details objects are too large");
  for (const [key, entry] of entries) {
    if (FORBIDDEN_DETAIL_KEY.test(key)) {
      throw new TypeError("audit details may not include secret-shaped field: " + path + "." + key);
    }
    validateSecretFree(entry, path + "." + key, depth + 1);
  }
}

function normalizeActor(actor) {
  if (!actor || typeof actor !== "object") throw new TypeError("audit actor is required");
  const kind = String(actor.kind ?? "");
  if (!["user", "control", "system"].includes(kind)) {
    throw new TypeError("audit actor kind is invalid");
  }
  return {
    kind,
    userId: validateIdentifier("actor.userId", actor.userId),
  };
}

function eventPayload(event) {
  return {
    version: event.version,
    sequence: event.sequence,
    timestamp: event.timestamp,
    type: event.type,
    outcome: event.outcome,
    actor: event.actor,
    workspaceId: event.workspaceId,
    projectId: event.projectId,
    details: event.details,
    previousHash: event.previousHash,
  };
}

function verifyEventShape(event, expectedSequence, previousHash) {
  if (event.version !== AUDIT_VERSION) throw new Error("audit event version mismatch");
  if (event.sequence !== expectedSequence) throw new Error("audit event sequence mismatch");
  if (typeof event.timestamp !== "string" || !Number.isFinite(Date.parse(event.timestamp))) {
    throw new Error("audit event timestamp invalid");
  }
  if (!EVENT_TYPE.test(event.type ?? "")) throw new Error("audit event type invalid");
  if (!OUTCOMES.has(event.outcome)) throw new Error("audit event outcome invalid");
  normalizeActor(event.actor);
  validateIdentifier("workspaceId", event.workspaceId);
  validateIdentifier("projectId", event.projectId);
  validateSecretFree(event.details ?? {});
  if (event.previousHash !== previousHash) throw new Error("audit event previous hash mismatch");
  const expectedHash = sha256(JSON.stringify(eventPayload(event)));
  if (event.hash !== expectedHash) throw new Error("audit event hash mismatch");
}

async function readEvents(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  if (!text.trim()) return [];
  const lines = text.split("\n").filter(Boolean);
  const events = [];
  let previousHash = null;
  for (let index = 0; index < lines.length; index += 1) {
    let event;
    try {
      event = JSON.parse(lines[index]);
    } catch {
      throw new Error("audit event JSON invalid at line " + (index + 1));
    }
    verifyEventShape(event, index + 1, previousHash);
    events.push(event);
    previousHash = event.hash;
  }
  return events;
}

export class ForgeAuditStore {
  constructor(root, {now = () => new Date()} = {}) {
    if (!root) throw new TypeError("root is required");
    if (typeof now !== "function") throw new TypeError("now must be a function");
    this.path = join(root, "audit", "events.jsonl");
    this.now = now;
    this.queue = Promise.resolve();
  }

  async verify() {
    const events = await readEvents(this.path);
    return {
      verified: true,
      events: events.length,
      lastSequence: events.at(-1)?.sequence ?? 0,
      lastHash: events.at(-1)?.hash ?? null,
    };
  }

  async append({
    type,
    outcome = "success",
    actor,
    workspaceId = null,
    projectId = null,
    details = {},
  }) {
    if (!EVENT_TYPE.test(String(type ?? ""))) throw new TypeError("audit event type is invalid");
    if (!OUTCOMES.has(outcome)) throw new TypeError("audit event outcome is invalid");
    const normalizedActor = normalizeActor(actor);
    workspaceId = validateIdentifier("workspaceId", workspaceId);
    projectId = validateIdentifier("projectId", projectId);
    validateSecretFree(details);

    const previous = this.queue.catch(() => {});
    const current = previous.then(async () => {
      const events = await readEvents(this.path);
      const previousHash = events.at(-1)?.hash ?? null;
      const event = {
        version: AUDIT_VERSION,
        sequence: events.length + 1,
        timestamp: this.now().toISOString(),
        type,
        outcome,
        actor: normalizedActor,
        workspaceId,
        projectId,
        details,
        previousHash,
      };
      event.hash = sha256(JSON.stringify(eventPayload(event)));
      const line = JSON.stringify(event) + "\n";
      if (Buffer.byteLength(line) > MAX_EVENT_BYTES) {
        throw new TypeError("audit event exceeds maximum size");
      }
      await mkdir(dirname(this.path), {recursive: true});
      await appendFile(this.path, line, {encoding: "utf8", mode: 0o600});
      return event;
    });
    this.queue = current;
    try {
      return await current;
    } finally {
      if (this.queue === current) this.queue = Promise.resolve();
    }
  }

  async list({limit = 100, workspaceId = null, projectId = null, type = null} = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      throw new TypeError("audit limit must be an integer between 1 and 1000");
    }
    workspaceId = validateIdentifier("workspaceId", workspaceId);
    projectId = validateIdentifier("projectId", projectId);
    if (type != null && !EVENT_TYPE.test(String(type))) {
      throw new TypeError("audit event type is invalid");
    }
    let events = await readEvents(this.path);
    if (workspaceId) events = events.filter((event) => event.workspaceId === workspaceId);
    if (projectId) events = events.filter((event) => event.projectId === projectId);
    if (type) events = events.filter((event) => event.type === type);
    return events.slice(-limit).reverse();
  }
}
