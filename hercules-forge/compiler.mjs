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
    '    const items = await this.all(entity);',
    '    return items[id] ?? null;',
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
    '    return this.mutate(entity, async ({items}) => {',
    '      items[id] = item;',
    '      return {value: item};',
    '    });',
    '  }',
    '',
    '  async delete(entity, id) {',
    '    return this.mutate(entity, async ({items}) => {',
    '      if (!(id in items)) return {write: false, value: false};',
    '      delete items[id];',
    '      return {value: true};',
    '    });',
    '  }',
    '}',
    '',
  ].join("\n");
}

function renderServer(spec) {
  const entities = JSON.stringify(spec.entities.map((entity) => entity.name));
  return [
    'import http from "node:http";',
    'import {randomUUID} from "node:crypto";',
    'import {ForgeRuntimeStore} from "./runtime-store.mjs";',
    '',
    'const port = Number(process.env.PORT ?? 3000);',
    'const host = process.env.HOST ?? "127.0.0.1";',
    'const MAX_BODY_BYTES = 1048576;',
    'const entities = ' + entities + ';',
    'const dataDir = process.env.FORGE_DATA_DIR ?? ".forge-data";',
    'const dataMaxBytes = Number(process.env.FORGE_DATA_MAX_BYTES ?? 52428800);',
    'const records = new ForgeRuntimeStore({dataDir, entities, maxBytes: dataMaxBytes});',
    'await records.init();',
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
    '      const input = await readJson(req);',
    '      const now = new Date().toISOString();',
    '      const item = {...input, id: randomUUID(), created_at: now, updated_at: now};',
    '      await records.put(entity, item.id, item);',
    '      return json(res, 201, item);',
    '    }',
    '    if (req.method === "PUT" && id) {',
    '      const current = await records.get(entity, id);',
    '      if (!current) return json(res, 404, {error: "not_found"});',
    '      const item = {...current, ...(await readJson(req)), id, updated_at: new Date().toISOString()};',
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
    "  <title>" + escapeHtml(spec.name) + "</title>",
    '  <link rel="stylesheet" href="/app.css" />',
    "</head>",
    "<body>",
    '  <header class="hero"><div><span class="eyebrow">Hercules Forge App</span><h1>' + escapeHtml(spec.name) + "</h1><p>" + escapeHtml(spec.description) + "</p></div></header>",
    '  <main><nav id="entityNav"></nav><section id="app"></section></main>',
    '  <script src="/app.js" defer></script>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function renderAppCss() {
  return [
    ":root{font-family:Inter,system-ui,sans-serif;color:#eef2ff;background:#080b12}",
    "*{box-sizing:border-box}body{margin:0}",
    ".hero{padding:28px clamp(18px,5vw,64px);border-bottom:1px solid #253047;background:#0d111a}",
    ".hero h1{margin:5px 0;font-size:clamp(28px,5vw,48px)}.hero p{color:#aab4c8;max-width:760px}.eyebrow{font-size:12px;letter-spacing:.16em;color:#8bc4ff;text-transform:uppercase}",
    "main{padding:24px clamp(18px,5vw,64px);max-width:1200px;margin:auto}nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}",
    "button{border:0;border-radius:9px;padding:10px 13px;font-weight:700;cursor:pointer}nav button{background:#172033;color:#dce6ff}.primary{background:#f5f7ff;color:#0b0f17}.danger{background:#331922;color:#ffb6c5}",
    ".grid{display:grid;grid-template-columns:minmax(260px,360px) 1fr;gap:20px}.panel{background:#111724;border:1px solid #273047;border-radius:14px;padding:18px}",
    "label{display:block;color:#aab4c8;font-size:13px;margin:10px 0}input,textarea{width:100%;margin-top:5px;background:#090d15;color:#fff;border:1px solid #303b52;border-radius:8px;padding:10px}textarea{min-height:90px}",
    ".item{border:1px solid #273047;border-radius:10px;padding:12px;margin:9px 0}.item pre{white-space:pre-wrap;overflow-wrap:anywhere}.muted{color:#8791a7;font-size:12px}.empty{color:#8791a7;padding:20px 0}",
    "@media(max-width:760px){.grid{grid-template-columns:1fr}}",
    "",
  ].join("\n");
}

function renderAppJs(spec) {
  const entities = JSON.stringify(spec.entities);
  const pages = JSON.stringify(spec.pages);
  return `(() => {
const entities=${entities}; const pages=${pages};
const entityByName=new Map(entities.map((entity)=>[entity.name,entity]));
const nav=document.getElementById("entityNav"); const app=document.getElementById("app");
let active=pages[0]?.entity?entityByName.get(pages[0].entity):entities[0]||null; let editing=null;
const esc=(v)=>String(v).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const inputType=(t)=>t==="number"?"number":t==="datetime"?"datetime-local":"text";
function coerce(field,value,checked){if(field.type==="boolean")return checked;if(field.type==="number")return value===""?null:Number(value);if(field.type==="json"){if(value==="")return null;return JSON.parse(value)}if(field.type==="datetime")return value?new Date(value).toISOString():null;return value}
async function request(path,options={}){const r=await fetch(path,{method:options.method||"GET",headers:{"content-type":"application/json"},body:options.body===undefined?undefined:JSON.stringify(options.body)});if(r.status===204)return null;const b=await r.json();if(!r.ok)throw new Error(b.error||("HTTP "+r.status));return b}
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
