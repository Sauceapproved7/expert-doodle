import {createHash} from "node:crypto";
import {validateForgeSpec} from "./schema.mjs";

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
    '  for await (const chunk of req) body += chunk;',
    '  return body ? JSON.parse(body) : {};',
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
    '      const now = new Date().toISOString();',
    '      const item = {id: randomUUID(), ...(await readJson(req)), created_at: now, updated_at: now};',
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
    '    return json(res, 500, {error: "internal_error", message: error.message});',
    '  }',
    '});',
    '',
    'if (process.env.NODE_ENV !== "test") server.listen(port);',
    '',
  ].join("\n");
}

function renderIndex(spec) {
  const cards = spec.pages.map((page) =>
    "<section><h2>" + page.name + "</h2><p>" + page.kind +
    (page.entity ? " · " + page.entity : "") + "</p></section>"
  ).join("\n");

  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width,initial-scale=1" />',
    "  <title>" + spec.name + "</title>",
    "  <style>",
    "    body{font-family:system-ui,sans-serif;max-width:960px;margin:40px auto;padding:0 20px}",
    "    section{border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0}",
    "  </style>",
    "</head>",
    "<body>",
    "  <h1>" + spec.name + "</h1>",
    "  <p>" + spec.description + "</p>",
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
