const SESSION_SCOPE = "xr:session";

function requireSessionScope(context) {
  if (!context || typeof context.actorId !== "string" || !Array.isArray(context.scopes) || !context.scopes.includes(SESSION_SCOPE)) {
    throw new Error(`Authorization requires ${SESSION_SCOPE}`);
  }
}

function normalizeStrings(values = []) {
  if (!Array.isArray(values)) throw new TypeError("capabilities must be an array");
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].sort();
}

function safeRenderer(renderer) {
  return typeof renderer === "string" && renderer.trim() ? renderer.trim() : "generic";
}

export class XRSceneEngine {
  #registry;
  #handlers;

  constructor({ registry, handlers = {} } = {}) {
    if (!registry || typeof registry.listScene !== "function") throw new TypeError("registry is required");
    this.#registry = registry;
    this.#handlers = new Map(Object.entries(handlers).filter(([, handler]) => typeof handler === "function"));
  }

  compose(sceneId, context) {
    const anchors = this.#registry.listScene(sceneId, context);
    return {
      schema: "sauceapproved.hercules.xr.frame",
      version: 1,
      sceneId,
      nodes: anchors
        .map((anchor) => ({
          id: anchor.id,
          pose: structuredClone(anchor.pose),
          payload: structuredClone(anchor.payload ?? {})
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
    };
  }

  openSession(sceneId, context, client = {}) {
    requireSessionScope(context);
    return Object.freeze({
      schema: "sauceapproved.hercules.xr.client-session",
      version: 1,
      sceneId,
      actorId: context.actorId,
      renderer: safeRenderer(client.renderer),
      capabilities: Object.freeze(normalizeStrings(client.capabilities))
    });
  }

  dispatch(intent, context) {
    requireSessionScope(context);
    if (!intent || typeof intent.type !== "string" || !intent.type.trim()) throw new TypeError("interaction type is required");
    const type = intent.type.trim();
    const handler = this.#handlers.get(type);
    if (!handler) throw new Error(`XR interaction ${type} is not allowlisted`);
    return handler(structuredClone(intent), Object.freeze({ actorId: context.actorId, scopes: [...context.scopes] }));
  }
}
