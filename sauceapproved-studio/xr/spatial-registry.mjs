const READ_SCOPE = "xr:read";
const WRITE_SCOPE = "xr:write";

function requireScope(context, scope) {
  if (!context || typeof context.actorId !== "string" || !Array.isArray(context.scopes) || !context.scopes.includes(scope)) {
    throw new Error(`Authorization requires ${scope}`);
  }
}

function finiteVector(value, length, label) {
  if (!Array.isArray(value) || value.length !== length || value.some((n) => !Number.isFinite(n))) {
    throw new TypeError(`pose.${label} must contain ${length} finite numbers`);
  }
}

function validateAnchor(anchor) {
  if (!anchor || typeof anchor !== "object") throw new TypeError("anchor is required");
  for (const key of ["id", "sceneId", "ownerId"]) {
    if (typeof anchor[key] !== "string" || !anchor[key].trim()) throw new TypeError(`anchor.${key} is required`);
  }
  finiteVector(anchor.pose?.position, 3, "position");
  finiteVector(anchor.pose?.rotation, 4, "rotation");
  if (anchor.payload !== undefined && (anchor.payload === null || typeof anchor.payload !== "object" || Array.isArray(anchor.payload))) {
    throw new TypeError("anchor.payload must be an object");
  }
}

function clone(value) {
  return structuredClone(value);
}

export class SpatialRegistry {
  #anchors = new Map();

  put(anchor, context) {
    requireScope(context, WRITE_SCOPE);
    validateAnchor(anchor);
    if (context.actorId !== anchor.ownerId) throw new Error("actor cannot write another owner's anchor");
    const safe = clone(anchor);
    this.#anchors.set(safe.id, safe);
    return clone(safe);
  }

  get(anchorId, context) {
    requireScope(context, READ_SCOPE);
    const anchor = this.#anchors.get(anchorId);
    if (!anchor || anchor.ownerId !== context.actorId) return null;
    return clone(anchor);
  }

  listScene(sceneId, context) {
    requireScope(context, READ_SCOPE);
    return [...this.#anchors.values()]
      .filter((anchor) => anchor.sceneId === sceneId && anchor.ownerId === context.actorId)
      .map(clone);
  }

  remove(anchorId, context) {
    requireScope(context, WRITE_SCOPE);
    const anchor = this.#anchors.get(anchorId);
    if (!anchor || anchor.ownerId !== context.actorId) return false;
    return this.#anchors.delete(anchorId);
  }

  exportScene(sceneId, context) {
    const anchors = this.listScene(sceneId, context);
    return {
      schema: "sauceapproved.hercules.xr.scene",
      version: 1,
      sceneId,
      anchors
    };
  }
}
