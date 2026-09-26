const MAX_PROMPT_CHARS = 12_000;
const MAX_MEMORY_CHARS = 12_000;
const MAX_TITLE_CHARS = 200;

function requiredString(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new TypeError(label + " is required");
  return text;
}

function normalizeOrigin(value) {
  const url = new URL(requiredString(value, "Supabase URL"));
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new TypeError("Supabase URL must be a credential-free HTTPS origin");
  }
  return url.origin;
}

function normalizeAccessTokenProvider(value) {
  if (typeof value === "function") {
    return async () => requiredString(await value(), "access token");
  }
  return async () => requiredString(value, "access token");
}

function metadata(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("metadata must be an object");
  }
  return value;
}

function boundedInteger(value, label, {min = 1, max} = {}) {
  if (value === undefined || value === null) return undefined;
  if (!Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
    throw new TypeError(label + " is invalid");
  }
  return value;
}

async function responseJson(response) {
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {error: text};
    }
  }
  if (!response.ok) {
    const message = body && typeof body === "object" && typeof body.error === "string"
      ? body.error
      : "HERCULES_CHAT_HTTP_" + response.status;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body ?? {};
}

export function createHerculesChatClient({
  supabaseUrl,
  anonKey,
  accessToken,
  fetchImpl = globalThis.fetch,
} = {}) {
  const origin = normalizeOrigin(supabaseUrl);
  const publicKey = requiredString(anonKey, "anon key");
  const resolveAccessToken = normalizeAccessTokenProvider(accessToken);
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  const endpoint = origin + "/functions/v1/hercules-chat";

  async function post(payload) {
    const bearer = await resolveAccessToken();
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        apikey: publicKey,
        authorization: "Bearer " + bearer,
      },
      body: JSON.stringify(payload),
    });
    return responseJson(response);
  }

  return Object.freeze({
    endpoint,

    async createSession({title, metadata: meta} = {}) {
      const payload = {action: "create_session"};
      if (title !== undefined) {
        const value = String(title).trim();
        if (value.length > MAX_TITLE_CHARS) throw new TypeError("title is too long");
        payload.title = value;
      }
      const cleanMeta = metadata(meta);
      if (cleanMeta !== undefined) payload.metadata = cleanMeta;
      return post(payload);
    },

    async listSessions({limit} = {}) {
      const payload = {action: "list_sessions"};
      const value = boundedInteger(limit, "limit", {min: 1, max: 100});
      if (value !== undefined) payload.limit = value;
      return post(payload);
    },

    async updateSession(sessionId, {title, status, metadata: meta} = {}) {
      const payload = {
        action: "update_session",
        session_id: requiredString(sessionId, "session id"),
      };
      if (title !== undefined) {
        const value = String(title).trim();
        if (value.length > MAX_TITLE_CHARS) throw new TypeError("title is too long");
        payload.title = value;
      }
      if (status !== undefined) {
        if (!["active", "archived"].includes(status)) throw new TypeError("session status is invalid");
        payload.status = status;
      }
      const cleanMeta = metadata(meta);
      if (cleanMeta !== undefined) payload.metadata = cleanMeta;
      if (!("title" in payload) && !("status" in payload) && !("metadata" in payload)) {
        throw new TypeError("session update requires a change");
      }
      return post(payload);
    },

    async deleteSession(sessionId) {
      return post({
        action: "delete_session",
        session_id: requiredString(sessionId, "session id"),
      });
    },

    async sendMessage(sessionId, content, {
      clientMessageId,
      parentMessageId,
      metadata: meta,
    } = {}) {
      if (content === undefined) throw new TypeError("message content is required");
      const payload = {
        action: "send_message",
        session_id: requiredString(sessionId, "session id"),
        content,
      };
      if (clientMessageId !== undefined) {
        payload.client_message_id = requiredString(clientMessageId, "client message id");
      }
      const parent = boundedInteger(parentMessageId, "parent message id", {min: 1});
      if (parent !== undefined) payload.parent_message_id = parent;
      const cleanMeta = metadata(meta);
      if (cleanMeta !== undefined) payload.metadata = cleanMeta;
      return post(payload);
    },

    async getMessages(sessionId, {afterId, limit} = {}) {
      const payload = {
        action: "get_messages",
        session_id: requiredString(sessionId, "session id"),
      };
      const after = boundedInteger(afterId, "after id", {min: 1});
      const count = boundedInteger(limit, "limit", {min: 1, max: 200});
      if (after !== undefined) payload.after_id = after;
      if (count !== undefined) payload.limit = count;
      return post(payload);
    },

    async remember(content, {
      memoryType,
      sessionId,
      sourceMessageId,
      expiresAt,
      metadata: meta,
    } = {}) {
      const value = requiredString(content, "memory");
      if (value.length > MAX_MEMORY_CHARS) throw new TypeError("memory is too long");
      const payload = {action: "remember", content: value};
      if (memoryType !== undefined) {
        const allowed = ["semantic", "preference", "fact", "summary", "instruction"];
        if (!allowed.includes(memoryType)) throw new TypeError("memory type is invalid");
        payload.memory_type = memoryType;
      }
      if (sessionId !== undefined) payload.session_id = requiredString(sessionId, "session id");
      const sourceId = boundedInteger(sourceMessageId, "source message id", {min: 1});
      if (sourceId !== undefined) payload.source_message_id = sourceId;
      if (expiresAt !== undefined) payload.expires_at = requiredString(expiresAt, "expires at");
      const cleanMeta = metadata(meta);
      if (cleanMeta !== undefined) payload.metadata = cleanMeta;
      return post(payload);
    },

    async searchMemory(query, {limit, threshold} = {}) {
      const value = requiredString(query, "memory query");
      if (value.length > 8_000) throw new TypeError("memory query is too long");
      const payload = {action: "search_memory", query: value};
      const count = boundedInteger(limit, "limit", {min: 1, max: 50});
      if (count !== undefined) payload.limit = count;
      if (threshold !== undefined) {
        if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
          throw new TypeError("memory threshold is invalid");
        }
        payload.threshold = threshold;
      }
      return post(payload);
    },

    async forgetMemory(memoryId) {
      return post({
        action: "forget_memory",
        memory_id: requiredString(memoryId, "memory id"),
      });
    },

    async usage() {
      return post({action: "usage"});
    },

    async runChat(sessionId, prompt, {
      clientMessageId,
      metadata: meta,
    } = {}) {
      const value = requiredString(prompt, "prompt");
      if (value.length > MAX_PROMPT_CHARS) throw new TypeError("prompt is too long");
      const payload = {
        action: "run_chat",
        session_id: requiredString(sessionId, "session id"),
        prompt: value,
      };
      if (clientMessageId !== undefined) {
        payload.client_message_id = requiredString(clientMessageId, "client message id");
      }
      const cleanMeta = metadata(meta);
      if (cleanMeta !== undefined) payload.metadata = cleanMeta;
      return post(payload);
    },
  });
}
