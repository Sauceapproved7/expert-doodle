export function builderConsoleHtml() {
  return `<!doctype html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hercules Forge Builder</title><link rel="stylesheet" href="/operator.css">
</head><body>
<header><strong>HERCULES FORGE</strong><span id="health">checking...</span></header>
<main>
<aside>
<label>Control token<input id="token" type="password" autocomplete="off" placeholder="session only"></label>
<button id="connect">Connect</button>
<h2>Projects</h2><div id="projects"></div>
</aside>
<section>
<div class="panel"><h1>Build from a prompt</h1>
<input id="projectId" placeholder="Project ID (optional)">
<textarea id="prompt" placeholder="Describe the app Hercules Forge should build..."></textarea>
<button id="create">Build project</button></div>
<div class="panel" id="projectPanel" hidden>
<h2 id="projectName"></h2><code id="selectedProject"></code>
<textarea id="revisionPrompt" placeholder="Describe the next change..."></textarea>
<div><button id="revise">Create revision</button><button id="preview">Preview latest</button><button id="publish">Publish latest</button><button id="stopPreview">Stop preview</button></div>
<div id="previewBox"></div><h3>Revisions</h3><div id="revisions"></div>
</div><pre id="status">Ready.</pre>
</section></main><script src="/operator.js" defer></script></body></html>`;
}

export function builderConsoleCss() {
  return `:root{font-family:system-ui,sans-serif;color:#eef2ff;background:#080b12}*{box-sizing:border-box}body{margin:0}header{display:flex;justify-content:space-between;padding:18px 24px;border-bottom:1px solid #263047;background:#0d111a}main{display:grid;grid-template-columns:290px 1fr;min-height:calc(100vh - 61px)}aside{padding:20px;border-right:1px solid #263047}main>section{padding:28px;max-width:1100px;width:100%}.panel{background:#111724;border:1px solid #273047;border-radius:14px;padding:20px;margin-bottom:18px}label{display:block;font-size:13px;color:#aab4c8}input,textarea{width:100%;margin:7px 0;background:#090d15;color:#fff;border:1px solid #303b52;border-radius:9px;padding:11px}textarea{min-height:115px}button{background:#f5f7ff;color:#0b0f17;border:0;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer;margin:5px 5px 5px 0}.project{padding:10px;border:1px solid #273047;border-radius:9px;margin:7px 0;cursor:pointer}.revision{padding:10px 0;border-bottom:1px solid #273047}.muted{color:#8791a7;font-size:12px}#status{white-space:pre-wrap;background:#080b12;border:1px solid #273047;padding:14px;border-radius:10px}a{color:#8bc4ff}@media(max-width:760px){main{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid #263047}main>section{padding:16px}}`;
}

export function builderConsoleJs() {
  return `(() => {
const $=(id)=>document.getElementById(id); let token=""; let selected=null; let revisions=[];
const esc=(v)=>String(v).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const status=(v)=>$("status").textContent=typeof v==="string"?v:JSON.stringify(v,null,2);
async function api(path,options={}){if(!token)throw new Error("Enter the control token first.");const r=await fetch(path,{method:options.method||"GET",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:options.body===undefined?undefined:JSON.stringify(options.body)});const b=await r.json();if(!r.ok)throw new Error(b.error||("HTTP "+r.status));return b}
async function refreshProjects(){const d=await api("/v1/projects");$("projects").innerHTML="";for(const p of d.projects){const el=document.createElement("div");el.className="project";el.innerHTML="<strong>"+esc(p.name)+"</strong><div class=muted>"+esc(p.projectId)+"</div>";el.onclick=()=>selectProject(p.projectId);$("projects").appendChild(el)}if(!d.projects.length)$("projects").textContent="No Forge projects yet."}
async function selectProject(id){selected=id;const [p,r]=await Promise.all([api("/v1/projects/"+encodeURIComponent(id)),api("/v1/projects/"+encodeURIComponent(id)+"/revisions")]);revisions=r.revisions;$("projectPanel").hidden=false;$("projectName").textContent=p.name;$("selectedProject").textContent=id;renderRevisions();await refreshPreview()}
function renderRevisions(){$("revisions").innerHTML="";[...revisions].reverse().forEach((r)=>{const el=document.createElement("div");el.className="revision";el.innerHTML="<strong>"+esc(r.message||"Revision")+"</strong><div class=muted>"+esc(r.revisionId)+"</div>";const a=document.createElement("button");a.textContent="Preview";a.onclick=()=>startPreview(r.revisionId);const b=document.createElement("button");b.textContent="Publish";b.onclick=()=>publishRevision(r.revisionId);el.append(a,b);$("revisions").appendChild(el)})}
async function refreshPreview(){try{const d=await api("/v1/projects/"+encodeURIComponent(selected)+"/preview");$("previewBox").innerHTML='<a target="_blank" rel="noopener" href="'+esc(d.preview.url)+'">Open running preview</a>'}catch{$("previewBox").textContent="No preview running."}}
async function startPreview(id){const d=await api("/v1/projects/"+encodeURIComponent(selected)+"/revisions/"+encodeURIComponent(id)+"/preview",{method:"POST"});$("previewBox").innerHTML='<a target="_blank" rel="noopener" href="'+esc(d.preview.url)+'">Open running preview</a>';status(d)}
async function publishRevision(id){status(await api("/v1/projects/"+encodeURIComponent(selected)+"/publish",{method:"POST",body:{revisionId:id}}))}
$("connect").onclick=async()=>{try{token=$("token").value;await refreshProjects();status("Connected to Forge.")}catch(e){status(e.message)}};
$("create").onclick=async()=>{try{const prompt=$("prompt").value.trim();if(!prompt)throw new Error("Describe the app first.");const projectId=$("projectId").value.trim();const d=await api("/v1/projects/from-prompt",{method:"POST",body:{prompt,metadata:projectId?{projectId}:{}}});status(d);await refreshProjects();await selectProject(d.project.projectId)}catch(e){status(e.message)}};
$("revise").onclick=async()=>{try{const prompt=$("revisionPrompt").value.trim();if(!selected||!prompt)throw new Error("Select a project and describe the change.");status(await api("/v1/projects/"+encodeURIComponent(selected)+"/revisions/from-prompt",{method:"POST",body:{prompt}}));await selectProject(selected)}catch(e){status(e.message)}};
$("preview").onclick=async()=>{try{if(!revisions.length)throw new Error("No revisions.");await startPreview(revisions.at(-1).revisionId)}catch(e){status(e.message)}};
$("publish").onclick=async()=>{try{if(!revisions.length)throw new Error("No revisions.");await publishRevision(revisions.at(-1).revisionId)}catch(e){status(e.message)}};
$("stopPreview").onclick=async()=>{try{status(await api("/v1/projects/"+encodeURIComponent(selected)+"/preview",{method:"DELETE"}));await refreshPreview()}catch(e){status(e.message)}};
fetch("/health").then(r=>r.json()).then(d=>$("health").textContent=d.ok?"Forge online":"Forge unavailable").catch(()=>$("health").textContent="Forge unavailable");
})();`;
}

export function builderConsoleAsset(pathname) {
  if (pathname === "/operator") return {type:"text/html; charset=utf-8", body:builderConsoleHtml()};
  if (pathname === "/operator.css") return {type:"text/css; charset=utf-8", body:builderConsoleCss()};
  if (pathname === "/operator.js") return {type:"text/javascript; charset=utf-8", body:builderConsoleJs()};
  return null;
}
