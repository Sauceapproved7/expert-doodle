export function customerConsoleHtml() {
  return `<!doctype html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hercules Forge</title><link rel="stylesheet" href="/customer-console.css">
</head><body>
<header><div><strong>HERCULES FORGE</strong><span>Customer Builder</span></div><div id="health">checking...</div></header>
<main>
<section id="loginPanel" class="auth-card">
  <h1>Sign in</h1>
  <p>Access your Forge workspace.</p>
  <label>Email<input id="email" type="email" autocomplete="username"></label>
  <label>Password<input id="password" type="password" autocomplete="current-password"></label>
  <div class="actions"><button id="login">Sign in</button><button id="forgot" class="secondary">Forgot password</button></div>
  <pre id="loginStatus"></pre>
</section>
<section id="lifecyclePanel" class="auth-card" hidden>
  <h1 id="lifecycleTitle">Account access</h1>
  <p id="lifecycleCopy"></p>
  <label>New password<input id="lifecyclePassword" type="password" autocomplete="new-password"></label>
  <div class="actions"><button id="lifecycleSubmit">Continue</button><button id="lifecycleCancel" class="secondary">Cancel</button></div>
  <pre id="lifecycleStatus"></pre>
</section>
<section id="appShell" hidden>
  <aside>
    <div class="user-row"><div><strong id="userEmail"></strong><div class="muted" id="role"></div></div><button id="logout">Log out</button></div>
    <label>Workspace<select id="workspace"></select></label>
    <section id="invitePanel" class="data-panel" hidden>
      <h3>Invite member</h3>
      <label>Email<input id="inviteEmail" type="email" autocomplete="off"></label>
      <label>Role<select id="inviteRole"><option value="viewer">Viewer</option><option value="builder">Builder</option><option value="admin">Admin</option></select></label>
      <button id="inviteMember">Send invite</button>
      <div id="inviteStatus" class="muted"></div>
    </section>
    <h2>Projects</h2><div id="projects"></div>
  </aside>
  <section class="workspace">
    <div class="panel" id="createPanel">
      <h1>Build from a prompt</h1>
      <input id="projectId" placeholder="Project ID (optional)">
      <textarea id="prompt" placeholder="Describe the app you want Hercules Forge to build..."></textarea>
      <button id="create">Build project</button>
    </div>
    <div class="panel" id="projectPanel" hidden>
      <div class="heading"><div><h2 id="projectName"></h2><code id="selectedProject"></code></div></div>
      <div id="builderControls">
        <textarea id="revisionPrompt" placeholder="Describe the next change..."></textarea>
        <div class="actions">
          <button id="revise">Create revision</button>
          <button id="preview">Preview latest</button>
          <button id="stopPreview">Stop preview</button>
        </div>
      </div>
      <div id="adminControls" class="actions">
        <button id="publish">Publish latest</button>
      </div>
      <div id="previewBox"></div>
      <section class="data-panel">
        <h3>Runtime data</h3>
        <div id="dataUsage" class="muted">Loading usage...</div>
        <div id="snapshotActions" class="actions"><button id="snapshot">Create snapshot</button></div>
        <div id="snapshots"></div>
      </section>
      <section id="auditPanel" class="data-panel" hidden>
        <div class="heading"><h3>Security audit</h3><button id="refreshAudit">Refresh</button></div>
        <div id="auditStatus" class="muted"></div>
        <div id="auditEvents"></div>
      </section>
      <h3>Revisions</h3><div id="revisions"></div>
    </div>
    <pre id="status">Ready.</pre>
  </section>
</section>
</main><script src="/customer-console.js" defer></script></body></html>`;
}

export function customerConsoleCss() {
  return `:root{font-family:Inter,system-ui,sans-serif;color:#eef2ff;background:#080b12}*{box-sizing:border-box}body{margin:0}header{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid #263047;background:#0d111a}header span{margin-left:10px;color:#8791a7}.auth-card{max-width:430px;margin:9vh auto;padding:26px;background:#111724;border:1px solid #273047;border-radius:16px}.auth-card p{color:#aab4c8}#appShell{display:grid;grid-template-columns:300px 1fr;min-height:calc(100vh - 61px)}aside{padding:20px;border-right:1px solid #263047}.workspace{padding:28px;max-width:1100px;width:100%}.panel{background:#111724;border:1px solid #273047;border-radius:14px;padding:20px;margin-bottom:18px}label{display:block;font-size:13px;color:#aab4c8;margin:8px 0}input,textarea,select{width:100%;margin-top:6px;background:#090d15;color:#fff;border:1px solid #303b52;border-radius:9px;padding:11px}textarea{min-height:115px;resize:vertical}button{background:#f5f7ff;color:#0b0f17;border:0;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer;margin:5px 5px 5px 0}button.secondary{background:#20283a;color:#e8edff;border:1px solid #34415c}.project{padding:10px;border:1px solid #273047;border-radius:9px;margin:7px 0;cursor:pointer}.project:hover{background:#151d2d}.muted{color:#8791a7;font-size:12px}.revision,.snapshot,.audit-event{padding:10px 0;border-bottom:1px solid #273047}.revision button,.snapshot button{font-size:12px;padding:7px 9px}.data-panel{margin-top:18px;padding-top:14px;border-top:1px solid #273047}.user-row{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:14px}.heading{display:flex;justify-content:space-between;gap:12px}.actions{margin:10px 0}pre{white-space:pre-wrap;background:#080b12;border:1px solid #273047;padding:14px;border-radius:10px;min-height:54px}a{color:#8bc4ff}@media(max-width:760px){#appShell{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid #263047}.workspace{padding:16px}}`;
}

export function customerConsoleJs() {
  return `(() => {
const $=(id)=>document.getElementById(id);
let csrf=""; let me=null; let workspaceId=null; let membership=null; let selected=null; let revisions=[];
let lifecycleKind=null; let lifecycleTokenValue="";
const esc=(v)=>String(v).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const status=(v)=>$("status").textContent=typeof v==="string"?v:JSON.stringify(v,null,2);
const loginStatus=(v)=>$("loginStatus").textContent=typeof v==="string"?v:JSON.stringify(v,null,2);
const canBuild=()=>["owner","admin","builder"].includes(membership?.role);
const canAdmin=()=>["owner","admin"].includes(membership?.role);

async function request(path,options={}){
  const headers={"content-type":"application/json",...(options.headers||{})};
  if(options.csrf) headers["x-forge-csrf"]=csrf;
  const response=await fetch(path,{method:options.method||"GET",headers,body:options.body===undefined?undefined:JSON.stringify(options.body),credentials:"same-origin"});
  const body=await response.json();
  if(!response.ok) throw new Error(body.error||("HTTP "+response.status));
  return body;
}

async function bootstrapSession(){
  me=await request("/v1/me");
  const rotated=await request("/v1/session/csrf");
  csrf=rotated.csrfToken;
  $("loginPanel").hidden=true; $("appShell").hidden=false; $("userEmail").textContent=me.user.email;
  $("workspace").innerHTML="";
  for(const entry of me.workspaces){
    const option=document.createElement("option");
    option.value=entry.workspace.workspaceId;
    option.textContent=entry.workspace.name;
    $("workspace").appendChild(option);
  }
  if(!me.workspaces.length){status("No workspace membership assigned.");return}
  await selectWorkspace(me.workspaces[0].workspace.workspaceId);
}

async function selectWorkspace(id){
  workspaceId=id; selected=null; revisions=[]; $("projectPanel").hidden=true;
  const data=await request("/v1/workspaces/"+encodeURIComponent(id)+"/projects");
  membership=data.membership; $("role").textContent=membership.role+" · "+data.workspace.name;
  $("createPanel").hidden=!canBuild(); $("builderControls").hidden=!canBuild(); $("adminControls").hidden=!canAdmin();
  $("auditPanel").hidden=!canAdmin(); $("invitePanel").hidden=!canAdmin();
  renderProjects(data.projects);
  if(canAdmin()) await refreshAudit();
}

function renderProjects(projects){
  $("projects").innerHTML="";
  for(const project of projects){
    const el=document.createElement("div"); el.className="project";
    el.innerHTML="<strong>"+esc(project.name)+"</strong><div class=muted>"+esc(project.projectId)+"</div>";
    el.onclick=()=>selectProject(project.projectId);
    $("projects").appendChild(el);
  }
  if(!projects.length) $("projects").textContent="No projects yet.";
}

async function refreshProjects(){
  if(!workspaceId)return;
  const data=await request("/v1/workspaces/"+encodeURIComponent(workspaceId)+"/projects");
  membership=data.membership; renderProjects(data.projects);
}

async function selectProject(id){
  selected=id;
  const base="/v1/workspaces/"+encodeURIComponent(workspaceId)+"/projects/"+encodeURIComponent(id);
  const [project,revisionData]=await Promise.all([request(base),request(base+"/revisions")]);
  revisions=revisionData.revisions;
  $("projectPanel").hidden=false; $("projectName").textContent=project.name; $("selectedProject").textContent=id;
  $("builderControls").hidden=!canBuild(); $("adminControls").hidden=!canAdmin();
  renderRevisions();
  await Promise.all([refreshPreview(), refreshData(), canAdmin()?refreshAudit():Promise.resolve()]);
}

function renderRevisions(){
  $("revisions").innerHTML="";
  [...revisions].reverse().forEach((revision)=>{
    const el=document.createElement("div"); el.className="revision";
    el.innerHTML="<strong>"+esc(revision.message||"Revision")+"</strong><div class=muted>"+esc(revision.revisionId)+"</div>";
    if(canBuild()){
      const preview=document.createElement("button"); preview.textContent="Preview"; preview.onclick=()=>startPreview(revision.revisionId); el.appendChild(preview);
    }
    if(canAdmin()){
      const publish=document.createElement("button"); publish.textContent="Publish"; publish.onclick=()=>publishRevision(revision.revisionId); el.appendChild(publish);
      const rollback=document.createElement("button"); rollback.textContent="Rollback"; rollback.onclick=()=>rollbackRevision(revision.revisionId); el.appendChild(rollback);
    }
    $("revisions").appendChild(el);
  });
}

function projectBase(){
  return "/v1/workspaces/"+encodeURIComponent(workspaceId)+"/projects/"+encodeURIComponent(selected);
}

async function refreshAudit(){
  if(!workspaceId||!canAdmin())return;
  let path="/v1/workspaces/"+encodeURIComponent(workspaceId)+"/audit?limit=25";
  if(selected)path+="&projectId="+encodeURIComponent(selected);
  const data=await request(path);
  $("auditStatus").textContent=data.integrity?.verified?"Audit chain verified":"Audit verification unavailable";
  $("auditEvents").innerHTML="";
  for(const event of data.events){
    const el=document.createElement("div"); el.className="audit-event";
    const actor=event.actor?.kind==="user"?(event.actor.userId||"user"):event.actor?.kind||"system";
    el.innerHTML="<strong>"+esc(event.type)+"</strong><div class=muted>"+
      esc(event.timestamp)+" · "+esc(event.outcome)+" · "+esc(actor)+"</div>";
    $("auditEvents").appendChild(el);
  }
  if(!data.events.length)$("auditEvents").textContent="No audit events for this scope.";
}

async function refreshData(){
  if(!selected)return;
  const [usageData,snapshotData]=await Promise.all([
    request(projectBase()+"/data/usage"),
    request(projectBase()+"/data/snapshots")
  ]);
  const usage=usageData.usage;
  const usedMb=(usage.totalBytes/1048576).toFixed(2);
  const maxMb=(usage.maxBytes/1048576).toFixed(2);
  $("dataUsage").textContent=usedMb+" MB used of "+maxMb+" MB · "+usage.files+" data files";
  $("snapshotActions").hidden=!canBuild();
  $("snapshots").innerHTML="";
  for(const snapshot of snapshotData.snapshots){
    const el=document.createElement("div"); el.className="snapshot";
    el.innerHTML="<strong>"+esc(new Date(snapshot.createdAt).toLocaleString())+"</strong><div class=muted>"+
      esc(snapshot.snapshotId)+" · "+(snapshot.totalBytes/1024).toFixed(1)+" KB</div>";
    if(canAdmin()){
      const restore=document.createElement("button");
      restore.textContent="Restore";
      restore.onclick=()=>restoreSnapshot(snapshot.snapshotId);
      el.appendChild(restore);
    }
    $("snapshots").appendChild(el);
  }
  if(!snapshotData.snapshots.length)$("snapshots").textContent="No snapshots yet.";
}

async function createSnapshot(){
  const data=await request(projectBase()+"/data/snapshots",{method:"POST",csrf:true});
  status(data);
  await Promise.all([refreshData(),refreshPreview()]);
}

async function restoreSnapshot(snapshotId){
  if(!confirm("Restore this verified snapshot? Current runtime data will be replaced."))return;
  const data=await request(
    projectBase()+"/data/snapshots/"+encodeURIComponent(snapshotId)+"/restore",
    {method:"POST",csrf:true}
  );
  status(data);
  await Promise.all([refreshData(),refreshPreview()]);
}

async function refreshPreview(){
  if(!selected)return;
  try{
    const data=await request(projectBase()+"/preview");
    $("previewBox").innerHTML='<a target="_blank" rel="noopener" href="'+esc(data.preview.url)+'">Open running preview</a>';
  }catch{$("previewBox").textContent="No preview running."}
}

async function startPreview(revisionId){
  const data=await request(projectBase()+"/revisions/"+encodeURIComponent(revisionId)+"/preview",{method:"POST",csrf:true});
  $("previewBox").innerHTML='<a target="_blank" rel="noopener" href="'+esc(data.preview.url)+'">Open running preview</a>'; status(data);
}

async function publishRevision(revisionId){status(await request(projectBase()+"/publish",{method:"POST",csrf:true,body:{revisionId}}))}
async function rollbackRevision(revisionId){status(await request(projectBase()+"/rollback",{method:"POST",csrf:true,body:{revisionId}}))}

function initLifecycle(){
  const fragment=location.hash.startsWith("#")?location.hash.slice(1):"";
  for(const kind of ["invite","recovery"]){
    const prefix=kind+"=";
    if(fragment.startsWith(prefix)){
      lifecycleKind=kind;
      try{lifecycleTokenValue=decodeURIComponent(fragment.slice(prefix.length))}catch{lifecycleTokenValue=""}
      history.replaceState(null,"",location.pathname);
      $("loginPanel").hidden=true; $("lifecyclePanel").hidden=false;
      $("lifecycleTitle").textContent=kind==="invite"?"Accept invitation":"Reset password";
      $("lifecycleCopy").textContent=kind==="invite"?"Set a password to join your Forge workspace.":"Set a new password for your Forge account.";
      $("lifecycleSubmit").textContent=kind==="invite"?"Accept invite":"Reset password";
      return true;
    }
  }
  return false;
}

async function finishLifecycle(){
  if(!lifecycleKind||!lifecycleTokenValue)throw new Error("This link is invalid or expired.");
  const password=$("lifecyclePassword").value;
  if(password.length<12)throw new Error("Password must be at least 12 characters.");
  const path=lifecycleKind==="invite"?"/v1/invites/accept":"/v1/recovery/complete";
  const body=lifecycleKind==="invite"?{token:lifecycleTokenValue,password}:{token:lifecycleTokenValue,password};
  const completed=await request(path,{method:"POST",body});
  const email=completed.user?.email;
  lifecycleTokenValue="";
  lifecycleKind=null;
  $("lifecyclePassword").value="";
  if(!email)throw new Error("Account lifecycle completed, but sign-in identity was unavailable.");
  const signedIn=await request("/v1/session",{method:"POST",body:{email,password}});
  csrf=signedIn.csrfToken;
  $("lifecyclePanel").hidden=true;
  await bootstrapSession();
}

async function sendInvite(){
  if(!workspaceId||!canAdmin())throw new Error("Admin workspace access required.");
  const email=$("inviteEmail").value.trim();
  if(!email)throw new Error("Invite email is required.");
  const data=await request("/v1/workspaces/"+encodeURIComponent(workspaceId)+"/invites",{
    method:"POST",csrf:true,body:{email,role:$("inviteRole").value}
  });
  $("inviteEmail").value="";
  $("inviteStatus").textContent="Invite sent to "+data.invite.email+".";
  await refreshAudit();
}

$("login").onclick=async()=>{
  try{
    const data=await request("/v1/session",{method:"POST",body:{email:$("email").value.trim(),password:$("password").value}});
    csrf=data.csrfToken; await bootstrapSession(); loginStatus("");
  }catch(error){loginStatus(error.message)}
};

$("forgot").onclick=async()=>{
  try{
    const email=$("email").value.trim();
    if(!email)throw new Error("Enter your email first.");
    await request("/v1/recovery/request",{method:"POST",body:{email}});
    loginStatus("If that account exists, a recovery link has been sent.");
  }catch(error){loginStatus(error.message)}
};

$("lifecycleSubmit").onclick=async()=>{try{await finishLifecycle()}catch(error){$("lifecycleStatus").textContent=error.message}};
$("lifecycleCancel").onclick=()=>{lifecycleTokenValue="";lifecycleKind=null;$("lifecyclePanel").hidden=true;$("loginPanel").hidden=false};
$("inviteMember").onclick=async()=>{try{await sendInvite()}catch(error){$("inviteStatus").textContent=error.message}};

$("logout").onclick=async()=>{
  try{await request("/v1/session",{method:"DELETE",csrf:true}); location.reload()}catch(error){status(error.message)}
};

$("workspace").onchange=()=>selectWorkspace($("workspace").value).catch((e)=>status(e.message));

$("create").onclick=async()=>{
  try{
    const prompt=$("prompt").value.trim(); if(!prompt)throw new Error("Describe the app first.");
    const projectId=$("projectId").value.trim();
    const data=await request("/v1/workspaces/"+encodeURIComponent(workspaceId)+"/projects/from-prompt",{method:"POST",csrf:true,body:{prompt,metadata:projectId?{projectId}:{}}});
    status(data); await refreshProjects(); await selectProject(data.project.projectId);
  }catch(error){status(error.message)}
};

$("revise").onclick=async()=>{
  try{
    const prompt=$("revisionPrompt").value.trim(); if(!selected||!prompt)throw new Error("Select a project and describe the change.");
    status(await request(projectBase()+"/revisions/from-prompt",{method:"POST",csrf:true,body:{prompt}})); await selectProject(selected);
  }catch(error){status(error.message)}
};

$("preview").onclick=async()=>{try{if(!revisions.length)throw new Error("No revisions.");await startPreview(revisions.at(-1).revisionId)}catch(error){status(error.message)}};
$("publish").onclick=async()=>{try{if(!revisions.length)throw new Error("No revisions.");await publishRevision(revisions.at(-1).revisionId)}catch(error){status(error.message)}};
$("stopPreview").onclick=async()=>{try{status(await request(projectBase()+"/preview",{method:"DELETE",csrf:true}));await refreshPreview()}catch(error){status(error.message)}};
$("snapshot").onclick=async()=>{try{await createSnapshot()}catch(error){status(error.message)}};
$("refreshAudit").onclick=async()=>{try{await refreshAudit()}catch(error){status(error.message)}};

const hasLifecycleLink=initLifecycle();
fetch("/health").then((r)=>r.json()).then((d)=>{
  $("health").textContent=d.ok?"Forge online":"Forge unavailable";
  $("forgot").hidden=!d.identityLifecycle;
}).catch(()=>$("health").textContent="Forge unavailable");
if(!hasLifecycleLink)bootstrapSession().catch(()=>{});
})();`;
}

export function customerConsoleAsset(pathname) {
  if (pathname === "/" || pathname === "/console") return {type:"text/html; charset=utf-8", body:customerConsoleHtml()};
  if (pathname === "/customer-console.css") return {type:"text/css; charset=utf-8", body:customerConsoleCss()};
  if (pathname === "/customer-console.js") return {type:"text/javascript; charset=utf-8", body:customerConsoleJs()};
  return null;
}
