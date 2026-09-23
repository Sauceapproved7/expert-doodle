import {createHash} from "node:crypto";
import {validateForgeSpec} from "./schema.mjs";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sqlType(type) {
  return {
    string: "text",
    number: "double precision",
    boolean: "boolean",
    datetime: "timestamptz",
    json: "jsonb",
  }[type] ?? "text";
}

function renderMigration(spec) {
  return spec.entities.map((entity) => {
    const columns = entity.fields.map((field) => {
      const required = field.required ? " not null" : "";
      return '  "' + field.name + '" ' + sqlType(field.type) + required + ",";
    });
    return [
      'create table if not exists "' + entity.name + '" (',
      '  "id" text primary key,',
      ...columns,
      '  "created_at" timestamptz not null default now(),',
      '  "updated_at" timestamptz not null default now()',
      ");",
    ].join("\n");
  }).join("\n\n") + "\n";
}

function renderManifest(spec) {
  return JSON.stringify({
    forgeSpecVersion: spec.version,
    engine: "hercules-forge-owned-core",
    app: {
      name: spec.name,
      description: spec.description,
      entities: spec.entities.map((entity) => entity.name),
      pages: spec.pages.map((page) => ({
        name: page.name,
        kind: page.kind,
        entity: page.entity ?? null,
      })),
      actions: spec.actions.map((action) => ({
        name: action.name,
        kind: action.kind,
        entity: action.entity ?? null,
      })),
    },
  }, null, 2) + "\n";
}

function renderServer(spec) {
  const entities = JSON.stringify(spec.entities.map((entity) => entity.name));
  return [
    'import http from "node:http";',
    'import {randomUUID} from "node:crypto";',
    '',
    'const port = Number(process.env.PORT ?? 3000);',
    'const host = process.env.HOST ?? "127.0.0.1";',
    'const MAX_BODY_BYTES = 1048576;',
    'const entities = ' + entities + ';',
    'const records = new Map(entities.map((name) => [name, new Map()]));',
    '',
    'function json(res, status, body) {',
    '  res.writeHead(status, {"content-type": "application/json; charset=utf-8"});',
    '  res.end(body === null ? "" : JSON.stringify(body));',
    '}',
    '',
    'async function readJson(req) {',
    '  let body = "";',
    '  for await (const chunk of req) {',
    '    body += chunk;',
    '    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {',
    '      throw Object.assign(new Error("request body too large"), {statusCode: 413});',
    '    }',
    '  }',
    '  if (!body) return {};',
    '  try {',
    '    return JSON.parse(body);',
    '  } catch {',
    '    throw Object.assign(new Error("invalid JSON body"), {statusCode: 400});',
    '  }',
    '}',
    '',
    'export const server = http.createServer(async (req, res) => {',
    '  try {',
    '    const url = new URL(req.url, "http://localhost");',
    '    if (req.method === "GET" && url.pathname === "/health") {',
    '      return json(res, 200, {ok: true, app: "' + spec.name + '", engine: "hercules-forge-owned-core"});',
    '    }',
    '    const parts = url.pathname.split("/").filter(Boolean);',
    '    if (parts[0] !== "api" || !records.has(parts[1])) return json(res, 404, {error: "not_found"});',
    '    const entity = parts[1];',
    '    const id = parts[2] ?? null;',
    '    const store = records.get(entity);',
    '    if (req.method === "GET" && !id) return json(res, 200, {entity, items: [...store.values()]});',
    '    if (req.method === "GET" && id) {',
    '      const item = store.get(id);',
    '      return item ? json(res, 200, item) : json(res, 404, {error: "not_found"});',
    '    }',
    '    if (req.method === "POST" && !id) {',
    '      const input = await readJson(req);',
    '      const now = new Date().toISOString();',
    '      const item = {...input, id: randomUUID(), created_at: now, updated_at: now};',
    '      store.set(item.id, item);',
    '      return json(res, 201, item);',
    '    }',
    '    if (req.method === "PUT" && id) {',
    '      if (!store.has(id)) return json(res, 404, {error: "not_found"});',
    '      const current = store.get(id);',
    '      const item = {...current, ...(await readJson(req)), id, updated_at: new Date().toISOString()};',
    '      store.set(id, item);',
    '      return json(res, 200, item);',
    '    }',
    '    if (req.method === "DELETE" && id) return json(res, store.delete(id) ? 204 : 404, null);',
    '    return json(res, 405, {error: "method_not_allowed"});',
    '  } catch (error) {',
    '    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;',
    '    return json(res, status, {error: status >= 500 ? "internal_error" : error.message});',
    '  }',
    '});',
    '',
    'if (process.env.NODE_ENV !== "test") {',
    '  server.listen(port, host, () => {',
    '    if (typeof process.send === "function") {',
    '      process.send({type: "forge-ready", address: server.address()});',
    '    }',
    '  });',
    '}',
    '',
  ].join("\n");
}

function renderIndex(spec) {
  const cards = spec.pages.map((page) =>
    "<section><h2>" + escapeHtml(page.name) + "</h2><p>" + escapeHtml(page.kind) +
    (page.entity ? " · " + escapeHtml(page.entity) : "") + "</p></section>"
  ).join("\n");

  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width,initial-scale=1" />',
    "  <title>" + escapeHtml(spec.name) + "</title>",
    "  <style>",
    "    body{font-family:system-ui,sans-serif;max-width:960px;margin:40px auto;padding:0 20px}",
    "    section{border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0}",
    "  </style>",
    "</head>",
    "<body>",
    "  <h1>" + escapeHtml(spec.name) + "</h1>",
    "  <p>" + escapeHtml(spec.description) + "</p>",
    "  " + (cards || "<p>No pages defined.</p>"),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

export function compileForgeProject(input) {
  const result = validateForgeSpec(input);
  if (!result.ok) {
    const error = new Error("invalid Forge spec");
    error.details = result.errors;
    throw error;
  }

  const spec = result.spec;
  const files = {
    "forge.manifest.json": renderManifest(spec),
    "db/001_init.sql": renderMigration(spec),
    "server.mjs": renderServer(spec),
    "public/index.html": renderIndex(spec),
  };

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({spec, files}))
    .digest("hex");

  return {
    engine: "hercules-forge-owned-core",
    engineVersion: "0.1",
    spec,
    files,
    fingerprint,
  };
}

export function compileFromInterpreter(interpreter, prompt) {
  if (!interpreter || typeof interpreter.interpret !== "function") {
    throw new TypeError("interpreter must implement interpret(prompt)");
  }
  return Promise.resolve(interpreter.interpret(prompt)).then(compileForgeProject);
}
