import {createHash} from "node:crypto";
import {validateForgeSpec} from "./schema.mjs";
import {createOwnerCodeAttestation} from "./ownership.mjs";

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

function renderRuntimeStore() {
  return [
    'import {mkdir, readFile, readdir, rename, stat, writeFile} from "node:fs/promises";',
    'import {join} from "node:path";',
    '',
    'const ENTITY = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;',
    'const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;',
    '',
    'async function readJson(path) {',
    '  try {',
    '    return JSON.parse(await readFile(path, "utf8"));',
    '  } catch (error) {',
    '    if (error?.code === "ENOENT") return {};',
    '    throw error;',
    '  }',
    '}',
    '',
    'function serializeJson(value) {',
    '  return JSON.stringify(value, null, 2) + "\\n";',
    '}',
    '',
    'async function atomicWrite(path, content) {',
    '  const temp = path + ".tmp-" + process.pid + "-" + Date.now();',
    '  await writeFile(temp, content, "utf8");',
    '  await rename(temp, path);',
    '}',
    '',
    'export class ForgeRuntimeStore {',
    '  constructor({dataDir, entities, maxBytes}) {',
    '    if (typeof dataDir !== "string" || !dataDir) throw new TypeError("dataDir is required");',
    '    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024) throw new TypeError("maxBytes must be an integer >= 1024");',
    '    this.dataDir = dataDir;',
    '    this.entities = new Set(entities);',
    '    this.maxBytes = maxBytes;',
    '    this.queue = Promise.resolve();',
    '  }',
    '',
    '  async init() {',
    '    await mkdir(this.dataDir, {recursive: true});',
    '  }',
    '',
    '  assertEntity(entity) {',
    '    if (!ENTITY.test(String(entity ?? "")) || !this.entities.has(entity)) {',
    '      throw Object.assign(new Error("unknown entity"), {statusCode: 404});',
    '    }',
    '    return entity;',
    '  }',
    '',
    '  assertRecordId(id) {',
    '    if (!RECORD_ID.test(String(id ?? "")) || ["__proto__", "prototype", "constructor"].includes(String(id))) {',
    '      throw Object.assign(new Error("invalid record id"), {statusCode: 400});',
    '    }',
    '    return String(id);',
    '  }',
    '',
    '  path(entity) {',
    '    return join(this.dataDir, this.assertEntity(entity) + ".json");',
    '  }',
    '',
    '  async all(entity) {',
    '    return readJson(this.path(entity));',
    '  }',
    '',
    '  async list(entity) {',
    '    return Object.values(await this.all(entity));',
    '  }',
    '',
    '  async get(entity, id) {',
    '    const key = this.assertRecordId(id);',
    '    const items = await this.all(entity);',
    '    return Object.hasOwn(items, key) ? items[key] : null;',
    '  }',
    '',
    '  async bytesExcluding(excludedPath) {',
    '    let total = 0;',
    '    for (const entry of await readdir(this.dataDir, {withFileTypes: true})) {',
    '      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;',
    '      const path = join(this.dataDir, entry.name);',
    '      if (path === excludedPath) continue;',
    '      total += (await stat(path)).size;',
    '    }',
    '    return total;',
    '  }',
    '',
    '  async mutate(entity, operation) {',
    '    const key = this.assertEntity(entity);',
    '    const previous = this.queue;',
    '    const current = previous.catch(() => {}).then(async () => {',
    '      const path = this.path(key);',
    '      const items = await readJson(path);',
    '      const result = await operation({path, items});',
    '      if (result?.write === false) return result.value;',
    '      const content = serializeJson(items);',
    '      const totalBytes = (await this.bytesExcluding(path)) + Buffer.byteLength(content);',
    '      if (totalBytes > this.maxBytes) {',
    '        throw Object.assign(new Error("runtime data quota exceeded"), {statusCode: 413});',
    '      }',
    '      await atomicWrite(path, content);',
    '      return result?.value;',
    '    });',
    '    this.queue = current;',
    '    try {',
    '      return await current;',
    '    } finally {',
    '      if (this.queue === current) this.queue = Promise.resolve();',
    '    }',
    '  }',
    '',
    '  async put(entity, id, item) {',
    '    const recordId = this.assertRecordId(id);',
    '    return this.mutate(entity, async ({items}) => {',
    '      items[recordId] = item;',
    '      return {value: item};',
    '    });',
    '  }',
    '',
    '  async delete(entity, id) {',
    '    const recordId = this.assertRecordId(id);',
    '    return this.mutate(entity, async ({items}) => {',
    '      if (!Object.hasOwn(items, recordId)) return {write: false, value: false};',
    '      delete items[recordId];',
    '      return {value: true};',
    '    });',
    '  }',
    '}',
    '',
  ].join("\n");
}

function renderServer(spec) {
  const entities = JSON.stringify(spec.entities.map((entity) => entity.name));
  const schemas = JSON.stringify(Object.fromEntries(
    spec.entities.map((entity) => [entity.name, entity.fields.map((field) => ({
      name: field.name,
      type: field.type,
      required: Boolean(field.required),
    }))]),
  ));
  return [
    'import http from "node:http";',
    'import {randomUUID} from "node:crypto";',
    'import {ForgeRuntimeStore} from "./runtime-store.mjs";',
    '',
    'const port = Number(process.env.PORT ?? 3000);',
    'const host = process.env.HOST ?? "127.0.0.1";',
    'const MAX_BODY_BYTES = 1048576;',
    'const entities = ' + entities + ';',
    'const schemas = ' + schemas + ';',
    'const dataDir = process.env.FORGE_DATA_DIR ?? ".forge-data";',
    'const dataMaxBytes = Number(process.env.FORGE_DATA_MAX_BYTES ?? 52428800);',
    'const records = new ForgeRuntimeStore({dataDir, entities, maxBytes: dataMaxBytes});',
    'await records.init();',
    '',
    'function json(res, status, body) {',
    '  res.writeHead(status, {',
    '    "content-type": "application/json; charset=utf-8",',
    '    "cache-control": "no-store",',
    '    "x-content-type-options": "nosniff",',
    '    "referrer-policy": "no-referrer",',
    '    "x-frame-options": "DENY",',
    '    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",',
    '  });',
    '  res.end(body === null ? "" : JSON.stringify(body));',
    '}',
    '',
    'function validateValue(field, value) {',
    '  if (value === null) {',
    '    if (field.required) throw Object.assign(new Error(field.name + " is required"), {statusCode: 400});',
    '    return value;',
    '  }',
    '  if (field.type === "string" && typeof value !== "string") throw Object.assign(new Error("invalid field type: " + field.name), {statusCode: 400});',
    '  if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw Object.assign(new Error("invalid field type: " + field.name), {statusCode: 400});',
    '  if (field.type === "boolean" && typeof value !== "boolean") throw Object.assign(new Error("invalid field type: " + field.name), {statusCode: 400});',
    '  if (field.type === "datetime" && (typeof value !== "string" || !Number.isFinite(Date.parse(value)))) throw Object.assign(new Error("invalid field type: " + field.name), {statusCode: 400});',
    '  return value;',
    '}',
    '',
    'function sanitizeInput(entity, input, requireRequired) {',
    '  if (!input || typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("JSON object body required"), {statusCode: 400});',
    '  const fields = schemas[entity] ?? [];',
    '  const allowed = new Map(fields.map((field) => [field.name, field]));',
    '  const clean = {};',
    '  for (const [key, value] of Object.entries(input)) {',
    '    if (["id", "created_at", "updated_at"].includes(key)) continue;',
    '    const field = allowed.get(key);',
    '    if (!field) throw Object.assign(new Error("unknown field: " + key), {statusCode: 400});',
    '    clean[key] = validateValue(field, value);',
    '  }',
    '  if (requireRequired) {',
    '    for (const field of fields) {',
    '      if (field.required && (!Object.hasOwn(clean, field.name) || clean[field.name] === null || clean[field.name] === "")) {',
    '        throw Object.assign(new Error(field.name + " is required"), {statusCode: 400});',
    '      }',
    '    }',
    '  }',
    '  return clean;',
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
    '      return json(res, 200, {ok: true, app: "' + spec.name + '", engine: "hercules-forge-owned-core", data: "persistent-file", dataMaxBytes});',
    '    }',
    '    const parts = url.pathname.split("/").filter(Boolean);',
    '    if (parts[0] !== "api" || !entities.includes(parts[1])) return json(res, 404, {error: "not_found"});',
    '    const entity = parts[1];',
    '    const id = parts[2] ?? null;',
    '    if (req.method === "GET" && !id) return json(res, 200, {entity, items: await records.list(entity)});',
    '    if (req.method === "GET" && id) {',
    '      const item = await records.get(entity, id);',
    '      return item ? json(res, 200, item) : json(res, 404, {error: "not_found"});',
    '    }',
    '    if (req.method === "POST" && !id) {',
    '      const input = sanitizeInput(entity, await readJson(req), true);',
    '      const now = new Date().toISOString();',
    '      const item = {...input, id: randomUUID(), created_at: now, updated_at: now};',
    '      await records.put(entity, item.id, item);',
    '      return json(res, 201, item);',
    '    }',
    '    if (req.method === "PUT" && id) {',
    '      const current = await records.get(entity, id);',
    '      if (!current) return json(res, 404, {error: "not_found"});',
    '      const input = sanitizeInput(entity, await readJson(req), false);',
    '      const item = {...current, ...input, id, updated_at: new Date().toISOString()};',
    '      for (const field of schemas[entity] ?? []) {',
    '        if (field.required && (item[field.name] === null || item[field.name] === "" || item[field.name] === undefined)) {',
    '          throw Object.assign(new Error(field.name + " is required"), {statusCode: 400});',
    '        }',
    '      }',
    '      await records.put(entity, id, item);',
    '      return json(res, 200, item);',
    '    }',
    '    if (req.method === "DELETE" && id) return json(res, (await records.delete(entity, id)) ? 204 : 404, null);',
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
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width,initial-scale=1" />',
    "  <title>" + escapeHtml(spec.name) + " · Hercules Forge</title>",
    '  <link rel="stylesheet" href="/app.css" />',
    "</head>",
    '<body class="forge-shell">',
    '  <div class="forge-frame">',
    '    <aside class="status-rail">',
    '      <div class="forge-mark"><span class="mark-core">H</span><div><strong>HERCULES FORGE</strong><small>OWNED BUILD SYSTEM</small></div></div>',
    '      <div class="rail-block"><span class="rail-label">ENGINE</span><b>Hercules Core</b><small>Owner-controlled runtime</small></div>',
    '      <div class="rail-block"><span class="rail-label">PROJECT</span><b>' + escapeHtml(spec.name) + '</b><small>Generated locally by Forge</small></div>',
    '      <div class="rail-block"><span class="rail-label">STATE</span><b class="state-ready">READY</b><small id="forge-status">System online</small></div>',
    '      <div class="rail-foot">SAUCEAPPROVED · HERCULES</div>',
    '    </aside>',
    '    <div class="forge-workspace">',
    '      <header class="command-deck">',
    '        <div><span class="eyebrow">HERCULES FORGE / ACTIVE BUILD</span><h1>' + escapeHtml(spec.name) + '</h1><p>' + escapeHtml(spec.description) + '</p></div>',
    '        <div class="command-badge"><span>BUILD MODE</span><strong>OWNED</strong></div>',
    '      </header>',
    '      <main class="workspace-body"><nav id="entityNav" class="forge-nav"></nav><section id="app"></section></main>',
    '    </div>',
    '  </div>',
    '  <script src="/app.js" defer></script>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function renderAppCss() {
  return [
    ":root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f5f7fb;background:#06080c;--panel:#0d1118;--panel2:#121823;--line:#293241;--steel:#9ca8b8;--hot:#f2f4f8;--accent:#d8ff3e;--danger:#ff5f6d}",
    "*{box-sizing:border-box}html,body{min-height:100%}body{margin:0;background:radial-gradient(circle at 72% 18%,rgba(216,255,62,.08),transparent 24%),linear-gradient(180deg,#07090d,#05070a 58%,#090c11)}",
    ".forge-frame{min-height:100vh;display:grid;grid-template-columns:248px 1fr}.status-rail{position:sticky;top:0;height:100vh;padding:24px 18px;border-right:1px solid #202734;background:linear-gradient(180deg,#090c11 0%,#07090d 100%);display:flex;flex-direction:column;gap:18px}",
    ".forge-mark{display:flex;gap:12px;align-items:center;padding-bottom:20px;border-bottom:1px solid #202734}.forge-mark strong{display:block;font-size:13px;letter-spacing:.11em}.forge-mark small{display:block;color:#707b8c;font-size:9px;letter-spacing:.17em;margin-top:3px}.mark-core{display:grid;place-items:center;width:42px;height:42px;border:1px solid #5f6a79;background:#111720;font-weight:950;font-size:22px;box-shadow:inset 0 0 0 3px #080b10}",
    ".rail-block{padding:14px;border:1px solid #202734;background:#0b0f15}.rail-block b,.rail-block small{display:block}.rail-block b{font-size:13px;margin:5px 0}.rail-block small{color:#7e899a;font-size:11px;line-height:1.45}.rail-label{font-size:9px;letter-spacing:.18em;color:#8894a5}.state-ready{color:var(--accent)}.rail-foot{margin-top:auto;color:#5d6674;font-size:9px;letter-spacing:.16em}",
    ".forge-workspace{min-width:0}.command-deck{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding:32px clamp(20px,4vw,56px);border-bottom:1px solid #202734;background:linear-gradient(180deg,rgba(17,22,31,.96),rgba(9,12,17,.94));box-shadow:0 20px 50px rgba(0,0,0,.18)}",
    ".command-deck h1{margin:7px 0 8px;font-size:clamp(30px,4.8vw,56px);letter-spacing:-.04em;line-height:.95}.command-deck p{margin:0;color:#929daf;max-width:760px;line-height:1.6}.eyebrow{font-size:10px;letter-spacing:.2em;color:var(--accent);font-weight:900}.command-badge{min-width:126px;padding:12px 14px;border:1px solid #394354;background:#0a0e14;text-align:right}.command-badge span,.command-badge strong{display:block}.command-badge span{font-size:9px;color:#778293;letter-spacing:.17em}.command-badge strong{font-size:18px;margin-top:3px}",
    ".workspace-body{padding:24px clamp(20px,4vw,56px);max-width:1500px}.forge-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px;padding-bottom:16px;border-bottom:1px solid #1d2430}",
    "button{appearance:none;border:1px solid #313b4b;border-radius:4px;padding:10px 13px;font-weight:800;cursor:pointer;background:#111722;color:#e7ebf2;transition:transform .15s ease,border-color .15s ease,background .15s ease}button:hover{transform:translateY(-1px);border-color:#667387;background:#171f2c}.forge-nav button{font-size:11px;letter-spacing:.04em}.primary{background:var(--accent);border-color:var(--accent);color:#07090d}.danger{background:#221015;border-color:#4b222b;color:#ffabb3}",
    ".grid{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:18px}.panel{background:linear-gradient(180deg,#101620,#0c1118);border:1px solid #232c39;border-radius:6px;padding:20px;box-shadow:0 18px 42px rgba(0,0,0,.16)}.panel h2{margin:0 0 14px;font-size:14px;letter-spacing:.04em;text-transform:uppercase}",
    "label{display:block;color:#9aa5b6;font-size:11px;letter-spacing:.04em;margin:12px 0}input,textarea{width:100%;margin-top:6px;background:#070a0f;color:#fff;border:1px solid #2c3543;border-radius:4px;padding:11px;outline:none}input:focus,textarea:focus{border-color:#778498;box-shadow:0 0 0 2px rgba(216,255,62,.07)}textarea{min-height:110px;resize:vertical}",
    ".item{border:1px solid #252e3b;background:#0a0e14;border-radius:5px;padding:13px;margin:9px 0}.item pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#c7d0dc;font-size:11px;line-height:1.5}.item button{margin-right:7px}.muted{color:#7f8a9b;font-size:11px}.empty{color:#6f7988;padding:20px 0}",
    "@media(max-width:900px){.forge-frame{grid-template-columns:1fr}.status-rail{position:relative;height:auto;display:grid;grid-template-columns:1fr 1fr;padding:14px}.forge-mark{grid-column:1/-1}.rail-foot{display:none}.grid{grid-template-columns:1fr}.command-deck{padding-top:24px}}",
    "@media(max-width:620px){.status-rail{grid-template-columns:1fr}.command-deck{flex-direction:column}.command-badge{width:100%;text-align:left}.workspace-body{padding:18px}.panel{padding:15px}}",
    "",
  ].join("\n");
}

function renderAppJs(spec) {
  const entities = JSON.stringify(spec.entities);
  const pages = JSON.stringify(spec.pages);
  return `(() => {
const entities=${entities}; const pages=${pages};
const entityByName=new Map(entities.map((entity)=>[entity.name,entity]));
const nav=document.getElementById("entityNav"); const app=document.getElementById("app"); const forgeStatus=document.getElementById("forge-status");
let active=pages[0]?.entity?entityByName.get(pages[0].entity):entities[0]||null; let editing=null;
const esc=(v)=>String(v).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const inputType=(t)=>t==="number"?"number":t==="datetime"?"datetime-local":"text";
function coerce(field,value,checked){if(field.type==="boolean")return checked;if(field.type==="number")return value===""?null:Number(value);if(field.type==="json"){if(value==="")return null;return JSON.parse(value)}if(field.type==="datetime")return value?new Date(value).toISOString():null;return value}
async function request(path,options={}){if(forgeStatus)forgeStatus.textContent="Working";try{const r=await fetch(path,{method:options.method||"GET",headers:{"content-type":"application/json"},body:options.body===undefined?undefined:JSON.stringify(options.body)});if(r.status===204){if(forgeStatus)forgeStatus.textContent="System online";return null}const b=await r.json();if(!r.ok)throw new Error(b.error||("HTTP "+r.status));if(forgeStatus)forgeStatus.textContent="System online";return b}catch(error){if(forgeStatus)forgeStatus.textContent="Action blocked";throw error}}
function renderNav(){nav.innerHTML="";const items=pages.length?pages:entities.map((entity)=>({name:entity.name,entity:entity.name}));for(const page of items){const b=document.createElement("button");b.textContent=page.name;b.onclick=()=>{active=page.entity?entityByName.get(page.entity):null;editing=null;render(page)};nav.appendChild(b)}}
function fieldControl(field,item={}){const label=document.createElement("label");label.textContent=field.name+(field.required?" *":"");let input;if(field.type==="boolean"){input=document.createElement("input");input.type="checkbox";input.checked=Boolean(item[field.name])}else if(field.type==="json"){input=document.createElement("textarea");input.value=item[field.name]===undefined||item[field.name]===null?"":JSON.stringify(item[field.name],null,2)}else{input=document.createElement("input");input.type=inputType(field.type);const raw=item[field.name];input.value=raw===undefined||raw===null?"":(field.type==="datetime"?String(raw).slice(0,16):raw)}input.dataset.field=field.name;label.appendChild(input);return label}
async function refreshList(entity,list){const data=await request("/api/"+encodeURIComponent(entity.name));list.innerHTML="";if(!data.items.length){list.innerHTML='<div class="empty">No records yet.</div>';return}for(const item of data.items){const card=document.createElement("div");card.className="item";card.innerHTML="<pre>"+esc(JSON.stringify(item,null,2))+"</pre>";const edit=document.createElement("button");edit.textContent="Edit";edit.onclick=()=>{editing=item;render()};const del=document.createElement("button");del.className="danger";del.textContent="Delete";del.onclick=async()=>{await request("/api/"+encodeURIComponent(entity.name)+"/"+encodeURIComponent(item.id),{method:"DELETE"});if(editing?.id===item.id)editing=null;render()};card.append(edit,del);list.appendChild(card)}}
function render(page=null){app.innerHTML="";if(!active){app.innerHTML='<div class="empty">'+esc(page?.name||"This page")+" has no data entity yet.</div>";return}const grid=document.createElement("div");grid.className="grid";const formPanel=document.createElement("section");formPanel.className="panel";const listPanel=document.createElement("section");listPanel.className="panel";formPanel.innerHTML="<h2>"+esc(editing?"Edit "+active.name:"Create "+active.name)+"</h2>";const form=document.createElement("form");for(const field of active.fields)form.appendChild(fieldControl(field,editing||{}));const save=document.createElement("button");save.className="primary";save.type="submit";save.textContent=editing?"Save changes":"Create";form.appendChild(save);if(editing){const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancel";cancel.onclick=()=>{editing=null;render()};form.appendChild(cancel)}form.onsubmit=async(e)=>{e.preventDefault();try{const body={};for(const field of active.fields){const input=form.querySelector('[data-field="'+CSS.escape(field.name)+'"]');body[field.name]=coerce(field,input.value,input.checked);if(field.required&&(body[field.name]===null||body[field.name]===""))throw new Error(field.name+" is required")}if(editing){await request("/api/"+encodeURIComponent(active.name)+"/"+encodeURIComponent(editing.id),{method:"PUT",body})}else{await request("/api/"+encodeURIComponent(active.name),{method:"POST",body})}editing=null;render()}catch(error){alert(error.message)}};formPanel.appendChild(form);listPanel.innerHTML="<h2>"+esc(active.name)+" records</h2>";const list=document.createElement("div");listPanel.appendChild(list);grid.append(formPanel,listPanel);app.appendChild(grid);refreshList(active,list).catch((error)=>{list.textContent=error.message})}
renderNav();render();
})();`;
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
    "runtime-store.mjs": renderRuntimeStore(),
    "public/index.html": renderIndex(spec),
    "public/app.css": renderAppCss(),
    "public/app.js": renderAppJs(spec),
  };

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({spec, files}))
    .digest("hex");

  return {
    engine: "hercules-forge-owned-core",
    engineVersion: "0.1",
    ownership: createOwnerCodeAttestation({engine: "hercules-forge-owned-core"}),
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
