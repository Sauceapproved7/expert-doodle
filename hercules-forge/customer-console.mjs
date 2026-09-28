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
    <div class="panel workbench-panel" id="projectPanel" hidden>
      <div class="heading workbench-heading">
        <div><div class="eyebrow">Hercules Forge Workbench</div><h2 id="projectName"></h2><code id="selectedProject"></code></div>
        <div class="workbench-badges"><span>OWNED CORE</span><span>PROOF-GATED</span></div>
      </div>
      <div class="workbench-grid">
        <section class="workbench-pane files-pane">
          <div class="pane-title"><strong>Files</strong><span id="fileCount" class="muted"></span></div>
          <div id="sourceFiles" class="file-tree"></div>
        </section>
        <section class="workbench-pane editor-shell">
          <div class="pane-title"><strong>Editor</strong><code id="editorPath">Select a generated file</code></div>
          <pre id="sourceEditor" class="source-editor">Choose a file from the revision source tree.</pre>
          <div id="editorMeta" class="muted"></div>
        </section>
        <section class="workbench-pane preview-shell">
          <div class="pane-title"><strong>Live preview</strong><span class="muted">isolated runtime</span></div>
          <div id="previewBox" class="preview-box">No preview running.</div>
          <div class="actions">
            <button id="preview">Preview latest</button>
            <button id="stopPreview" class="secondary">Stop preview</button>
          </div>
        </section>
        <section class="workbench-pane agent-shell">
          <div class="pane-title"><strong>Hercules Agent</strong><span class="muted">architect · builder · tester · release</span></div>
          <div id="builderControls">
            <textarea id="revisionPrompt" placeholder="Tell Hercules what to change. Forge records a new immutable revision instead of silently mutating history."></textarea>
            <button id="revise">Build revision</button>
          </div>
          <div id="adminControls" class="actions">
            <button id="publish">Publish verified revision</button>
          </div>
          <div class="proof-card">
            <div class="pane-title"><strong>Proof Gate</strong><span id="proofState" class="muted"></span></div>
            <div id="proofGate"></div>
          </div>
        </section>
      </div>
      <section class="terminal-panel">
        <div class="pane-title"><strong>Terminal / Output</strong><span class="muted">read-only Forge activity stream</span></div>
        <pre id="terminalOutput">Forge workbench ready.</pre>
      </section>
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
      <section class="ledger-panel">
        <div class="pane-title"><strong>Build Ledger</strong><span class="muted">immutable revisions · checkpoints · rollback</span></div>
        <div id="revisions"></div>
      </section>
    </div>
    <pre id="status">Ready.</pre>
  </section>
</section>
</main><script src="/customer-console.js" defer></script></body></html>`;
}

export function customerConsoleCss() {
  return `:root{font-family:Inter,system-ui,sans-serif;color:#eef2ff;background:#07090e}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 70% -20%,#17223a 0,#07090e 38%,#05070b 100%);min-height:100vh}header{display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid #263047;background:rgba(9,13,21,.94);backdrop-filter:blur(14px);position:sticky;top:0;z-index:20}header strong{letter-spacing:.08em}header span{margin-left:10px;color:#8791a7}.auth-card{max-width:430px;margin:9vh auto;padding:26px;background:#101622;border:1px solid #273047;border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.35)}.auth-card p{color:#aab4c8}#appShell{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:calc(100vh - 58px)}aside{padding:18px;border-right:1px solid #263047;background:rgba(9,13,21,.8)}.workspace{padding:22px;max-width:none;width:100%;overflow:hidden}.panel{background:#0f1520;border:1px solid #273047;border-radius:16px;padding:18px;margin-bottom:18px;box-shadow:0 18px 55px rgba(0,0,0,.18)}label{display:block;font-size:13px;color:#aab4c8;margin:8px 0}input,textarea,select{width:100%;margin-top:6px;background:#070b12;color:#fff;border:1px solid #303b52;border-radius:9px;padding:11px}textarea{min-height:108px;resize:vertical}button{background:#f5f7ff;color:#0b0f17;border:0;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer;margin:5px 5px 5px 0}button.secondary{background:#20283a;color:#e8edff;border:1px solid #34415c}.project{padding:11px;border:1px solid #273047;border-radius:10px;margin:7px 0;cursor:pointer;background:#0b1019}.project:hover{background:#151d2d;border-color:#40506f}.muted{color:#8791a7;font-size:12px}.revision,.snapshot,.audit-event{padding:10px 0;border-bottom:1px solid #273047}.revision button,.snapshot button{font-size:12px;padding:7px 9px}.data-panel,.ledger-panel{margin-top:18px;padding-top:14px;border-top:1px solid #273047}.user-row{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:14px}.heading,.pane-title{display:flex;justify-content:space-between;gap:12px;align-items:center}.actions{margin:10px 0}pre{white-space:pre-wrap;background:#070b12;border:1px solid #273047;padding:14px;border-radius:10px;min-height:54px}a{color:#9fc7ff}.eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#6f7f9f;font-weight:800}.workbench-panel{padding:16px}.workbench-heading{margin-bottom:14px}.workbench-badges{display:flex;gap:7px;flex-wrap:wrap}.workbench-badges span{font-size:9px;letter-spacing:.14em;border:1px solid #3b4862;background:#121a28;border-radius:999px;padding:6px 8px;color:#b9c6dd}.workbench-grid{display:grid;grid-template-columns:220px minmax(320px,1.35fr) minmax(260px,.9fr);grid-template-areas:"files editor agent" "files preview agent";gap:10px;min-height:560px}.workbench-pane{border:1px solid #273047;border-radius:12px;background:#090e16;overflow:hidden}.workbench-pane>.pane-title{padding:10px 12px;border-bottom:1px solid #273047;background:#0d131e}.files-pane{grid-area:files}.editor-shell{grid-area:editor;min-height:330px}.preview-shell{grid-area:preview;padding-bottom:10px}.agent-shell{grid-area:agent;padding-bottom:12px}.agent-shell #builderControls,.agent-shell #adminControls,.proof-card{padding:10px 12px}.file-tree{padding:8px;max-height:700px;overflow:auto}.file-item{display:block;width:100%;text-align:left;background:transparent;color:#c8d2e7;border:1px solid transparent;padding:8px 9px;margin:2px 0;font:500 12px ui-monospace,SFMono-Regular,Menlo,monospace}.file-item:hover,.file-item.active{background:#151e2e;border-color:#31415e}.source-editor{margin:0;border:0;border-radius:0;min-height:290px;max-height:430px;overflow:auto;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;color:#d7e0ef}.editor-shell #editorMeta{padding:8px 12px;border-top:1px solid #273047}.preview-box{min-height:96px;padding:14px;display:flex;align-items:center;color:#9aa6bb}.proof-card{border-top:1px solid #273047;margin-top:10px}.proof-row{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid #1d2636;font-size:12px}.proof-pass{color:#9ee6b1}.proof-block{color:#ffbd9d}.terminal-panel{margin-top:10px;border:1px solid #273047;border-radius:12px;overflow:hidden;background:#06090e}.terminal-panel .pane-title{padding:9px 12px;border-bottom:1px solid #273047}.terminal-panel pre{margin:0;border:0;border-radius:0;max-height:180px;overflow:auto;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#a9b8cf}.ledger-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:11px 0;border-bottom:1px solid #273047}.ledger-entry code{font-size:11px;color:#8da1bf}.ledger-meta{font-size:11px;color:#6f7f9f;margin-top:4px}.status-chip{font-size:10px;padding:4px 7px;border-radius:999px;border:1px solid #32415b;color:#b8c6de}@media(max-width:1100px){.workbench-grid{grid-template-columns:200px minmax(0,1fr);grid-template-areas:"files editor" "files agent" "preview preview"}}@media(max-width:760px){#appShell{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid #263047}.workspace{padding:10px}.workbench-grid{grid-template-columns:1fr;grid-template-areas:"agent" "files" "editor" "preview";min-height:0}.files-pane{max-height:280px}.source-editor{max-height:360px}.workbench-heading{align-items:flex-start;flex-direction:column}.workbench-badges{margin-top:6px}}`;
}

export function customerConsoleJs() {
  return `(() => {
const $=(id)=>document.getElementById(id);
let csrf=""; let me=null; let workspaceId=null; let membership=null; let selected=null; let revisions=[];
let selectedRevisionId=null; let selectedSourcePath=null;
let lifecycleKind=null; let lifecycleTokenValue="";
const esc=(v)=>String(v).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const status=(v)=>{const value=typeof v==="string"?v:JSON.stringify(v,null,2);$("status").textContent=value;const terminal=$("terminalOutput");if(terminal){const stamp=new Date().toLocaleTimeString();terminal.textContent=("["+stamp+"] "+value+"\n"+terminal.textContent).slice(0,12000)}};
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
  selectedRevisionId=revisions.at(-1)?.revisionId||null;
  renderFileTree();
  renderProofGate();
  renderBuildLedger();
  if(selectedRevisionId){
    const firstPath=Object.keys(revisions.at(-1)?.files||{}).sort()[0];
    if(firstPath)await loadSourceFile(selectedRevisionId,firstPath);
  }
  await Promise.all([refreshPreview(), refreshData(), canAdmin()?refreshAudit():Promise.resolve()]);
}

function renderFileTree(){
  const revision=revisions.at(-1);
  const files=Object.keys(revision?.files||{}).sort();
  $("sourceFiles").innerHTML="";
  $("fileCount").textContent=files.length+" files";
  for(const path of files){
    const button=document.createElement("button");
    button.className="file-item"+(path===selectedSourcePath?" active":"");
    button.textContent=path;
    button.onclick=()=>loadSourceFile(revision.revisionId,path).catch((error)=>status(error.message));
    $("sourceFiles").appendChild(button);
  }
  if(!files.length)$("sourceFiles").textContent="No generated source indexed.";
}

async function loadSourceFile(revisionId,path){
  const data=await request(projectBase()+"/revisions/"+encodeURIComponent(revisionId)+"/source?path="+encodeURIComponent(path));
  selectedRevisionId=revisionId; selectedSourcePath=path;
  $("editorPath").textContent=path;
  $("sourceEditor").textContent=data.source.content;
  $("editorMeta").textContent=data.source.bytes+" bytes · sha256 "+data.source.sha256.slice(0,16)+"…";
  renderFileTree();
  return data.source;
}

function renderProofGate(){
  const revision=revisions.at(-1);
  const checks=[
    ["Immutable revision",Boolean(revision?.revisionId)],
    ["Source indexed",Object.keys(revision?.files||{}).length>0],
    ["Build fingerprint",Boolean(revision?.fingerprint)],
    ["Ownership attestation",Boolean(revision?.ownership)],
  ];
  const clear=checks.every(([,ok])=>ok);
  $("proofState").textContent=clear?"READY FOR VALIDATION":"BLOCKED";
  $("proofGate").innerHTML="";
  for(const [label,ok] of checks){
    const row=document.createElement("div");row.className="proof-row";
    row.innerHTML="<span>"+esc(label)+"</span><strong class='"+(ok?"proof-pass":"proof-block")+"'>"+(ok?"PASS":"BLOCK")+"</strong>";
    $("proofGate").appendChild(row);
  }
}

function renderBuildLedger(){
  $("revisions").innerHTML="";
  [...revisions].reverse().forEach((revision,index)=>{
    const el=document.createElement("div");el.className="ledger-entry";
    const fileCount=Object.keys(revision.files||{}).length;
    const detail=document.createElement("div");
    detail.innerHTML="<strong>"+esc(revision.message||"Revision")+"</strong><div class=ledger-meta>"+esc(revision.createdAt)+" · "+fileCount+" files · fingerprint "+esc((revision.fingerprint||"").slice(0,12))+"</div><code>"+esc(revision.revisionId)+"</code>";
    const actions=document.createElement("div");
    if(canBuild()){
      const preview=document.createElement("button");preview.textContent="Preview";preview.onclick=()=>startPreview(revision.revisionId);actions.appendChild(preview);
    }
    if(canAdmin()){
      const publish=document.createElement("button");publish.textContent="Publish";publish.onclick=()=>publishRevision(revision.revisionId);actions.appendChild(publish);
      if(index>0){const rollback=document.createElement("button");rollback.textContent="Rollback";rollback.onclick=()=>rollbackRevision(revision.revisionId);actions.appendChild(rollback)}
    }
    el.append(detail,actions);$("revisions").appendChild(el);
  });
  if(!revisions.length)$("revisions").textContent="No build ledger entries yet.";
}

function renderRevisions(){renderBuildLedger()}

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
