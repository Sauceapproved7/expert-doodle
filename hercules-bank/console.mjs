export function bankConsoleHtml(){
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Hercules Financial</title>
<link rel="stylesheet" href="/bank-console.css">
</head><body>
<div class="ambient"></div>
<header class="topbar">
  <div class="brand"><div class="mark">H</div><div><strong>HERCULES FINANCIAL</strong><span>SANDBOX</span></div></div>
  <div class="status"><i></i><span id="health">Checking system</span></div>
</header>
<main>
  <section id="loginPanel" class="login-shell">
    <div class="eyebrow">PRIVATE FINANCIAL CORE</div>
    <h1>Your money layer,<br>built into Hercules.</h1>
    <p class="lead">Sign in with your Hercules account. This environment uses test balances only.</p>
    <div class="login-card">
      <label>Email<input id="email" type="email" autocomplete="username" inputmode="email"></label>
      <label>Password<input id="password" type="password" autocomplete="current-password"></label>
      <button id="login" class="primary">Enter Financial</button>
      <div id="loginStatus" class="message"></div>
    </div>
  </section>

  <section id="app" hidden>
    <aside class="rail">
      <div class="profile"><div class="avatar">H</div><div><strong id="userEmail"></strong><span>Hercules member</span></div></div>
      <nav>
        <button class="nav active" data-view="overview">Overview</button>
        <button class="nav" data-view="transfer">Transfer</button>
        <button class="nav" data-view="activity">Activity</button>
        <button id="ownerNav" class="nav" data-view="owner" hidden>Owner</button>
      </nav>
      <div class="rail-bottom">
        <div class="sandbox-note"><strong>Sandbox mode</strong><span>No real deposits or external rails.</span></div>
        <button id="logout" class="quiet">Sign out</button>
      </div>
    </aside>

    <section class="workspace">
      <div class="workspace-head">
        <div><div class="eyebrow">FINANCIAL HOME</div><h2 id="welcome">Overview</h2></div>
        <button id="newAccount" class="primary compact">+ New sandbox account</button>
      </div>

      <section id="overviewView" class="view">
        <div class="hero-balance">
          <span>Total sandbox balance</span>
          <strong id="totalBalance">$0.00</strong>
          <small>USD · Test funds</small>
        </div>
        <div class="section-head"><h3>Accounts</h3><button id="refreshAccounts" class="quiet compact">Refresh</button></div>
        <div id="accounts" class="account-grid"></div>
      </section>

      <section id="transferView" class="view" hidden>
        <div class="panel">
          <div class="eyebrow">INTERNAL TRANSFER</div>
          <h3>Move sandbox funds</h3>
          <p>Transfer between Hercules Financial sandbox accounts. External rails remain disabled.</p>
          <label>From<select id="fromAccount"></select></label>
          <label>Recipient account ID<input id="toAccount" autocomplete="off" placeholder="acct_..."></label>
          <label>Amount (USD)<input id="amount" inputmode="decimal" placeholder="0.00"></label>
          <label>Note<input id="reference" maxlength="120" placeholder="Optional note"></label>
          <button id="sendTransfer" class="primary">Send sandbox transfer</button>
          <div id="transferStatus" class="message"></div>
        </div>
      </section>

      <section id="activityView" class="view" hidden>
        <div class="section-head"><h3>Account activity</h3><select id="statementAccount"></select></div>
        <div class="panel"><div id="statementMeta" class="muted"></div><div id="activity" class="activity-list"></div></div>
      </section>

      <section id="ownerView" class="view" hidden>
        <div class="section-head">
          <div><div class="eyebrow">OWNER CONTROLS</div><h3>Sandbox control center</h3></div>
          <span class="owner-badge">OWNER</span>
        </div>
        <div class="owner-metrics">
          <div><span>Customer accounts</span><strong id="ownerAccountCount">0</strong></div>
          <div><span>Customers</span><strong id="ownerCustomerCount">0</strong></div>
          <div><span>Sandbox liabilities</span><strong id="ownerLiabilities">$0.00</strong></div>
        </div>
        <div class="panel compliance-panel">
          <div class="section-head">
            <div><div class="eyebrow">REGULATED CONTROLS</div><h3>Compliance readiness</h3></div>
            <span id="complianceState" class="lock-badge">LIVE MONEY LOCKED</span>
          </div>
          <p>Evidence, provider readiness, and reconciliation status. Readiness never enables external money movement.</p>
          <div class="compliance-grid">
            <div><span>Controls approved</span><strong id="approvedControls">0</strong></div>
            <div><span>Open blockers</span><strong id="complianceBlockers">0</strong></div>
            <div><span>Provider</span><strong id="complianceProvider">Not set</strong></div>
            <div><span>Latest reconciliation</span><strong id="complianceRecon">None</strong></div>
          </div>
          <div id="complianceList" class="control-list"></div>
          <div class="lock-note"><strong>Live money locked.</strong> No dashboard control can enable ACH, wires, RTP, FedNow, cards, or deposits.</div>
        </div>
        <div class="panel owner-panel">
          <div class="eyebrow">SANDBOX FUNDING</div>
          <h3>Add sandbox funds</h3>
          <p>Credit test value to a customer account. No external money moves.</p>
          <label>Account<select id="ownerFundAccount"></select></label>
          <label>Amount (USD)<input id="ownerFundAmount" inputmode="decimal" placeholder="100.00"></label>
          <button id="ownerFund" class="primary">Add sandbox funds</button>
          <div id="ownerStatus" class="message"></div>
        </div>
      </section>
    </section>
  </section>
</main>
<script src="/bank-console.js" defer></script>
</body></html>`;
}

export function bankConsoleCss(){
  return `:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f5f7fb;background:#07090d;--panel:#10141b;--panel2:#151b25;--line:#252d3a;--muted:#8b96a8;--accent:#f4d27a;--accent2:#c89e38}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 70% -20%,#252017 0,transparent 34%),#07090d}.ambient{position:fixed;inset:0;pointer-events:none;background:linear-gradient(120deg,rgba(255,255,255,.025),transparent 25%,transparent 75%,rgba(244,210,122,.025))}.topbar{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 28px;border-bottom:1px solid var(--line);background:rgba(7,9,13,.86);backdrop-filter:blur(16px);position:sticky;top:0;z-index:5}.brand{display:flex;align-items:center;gap:12px}.brand strong{display:block;letter-spacing:.12em;font-size:13px}.brand span{display:inline-block;margin-top:4px;padding:2px 7px;border:1px solid #5a4c29;border-radius:999px;color:var(--accent);font-size:10px;letter-spacing:.16em}.mark,.avatar{display:grid;place-items:center;background:linear-gradient(145deg,#f5dc99,#9b7628);color:#0b0d10;font-weight:900}.mark{width:38px;height:38px;border-radius:11px}.avatar{width:42px;height:42px;border-radius:50%}.status{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px}.status i{width:7px;height:7px;border-radius:50%;background:#57d38c;box-shadow:0 0 14px #57d38c}.login-shell{max-width:980px;margin:10vh auto;padding:40px}.eyebrow{font-size:11px;letter-spacing:.18em;color:var(--accent);font-weight:800}.login-shell h1{font-size:clamp(44px,7vw,78px);line-height:.96;letter-spacing:-.05em;margin:16px 0 20px;max-width:820px}.lead{color:#a8b1c1;max-width:570px;font-size:18px;line-height:1.6}.login-card{margin-top:34px;max-width:450px;background:rgba(16,20,27,.9);border:1px solid var(--line);border-radius:18px;padding:24px;box-shadow:0 26px 70px rgba(0,0,0,.35)}label{display:block;color:#aeb7c6;font-size:12px;margin:12px 0}input,select{width:100%;margin-top:7px;padding:13px 14px;border-radius:11px;border:1px solid #303848;background:#090c11;color:#fff;outline:none}input:focus,select:focus{border-color:#7d6b40;box-shadow:0 0 0 3px rgba(244,210,122,.08)}button{font:inherit;cursor:pointer}.primary{border:0;border-radius:11px;padding:13px 16px;font-weight:850;background:linear-gradient(135deg,#f5dc99,#b88b2f);color:#111}.login-card .primary{width:100%;margin-top:10px}.quiet{border:1px solid var(--line);border-radius:10px;padding:10px 13px;background:#10151d;color:#dce2ec}.compact{padding:9px 12px;font-size:12px}.message{min-height:20px;margin-top:12px;color:#bac3d2;font-size:12px}#app{display:grid;grid-template-columns:260px 1fr;min-height:calc(100vh - 72px)}.rail{padding:22px 18px;border-right:1px solid var(--line);display:flex;flex-direction:column}.profile{display:flex;gap:11px;align-items:center;padding:8px}.profile strong{display:block;font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis}.profile span{display:block;color:var(--muted);font-size:11px;margin-top:3px}.rail nav{margin-top:28px;display:grid;gap:7px}.nav{border:0;background:transparent;color:#9ca6b6;text-align:left;padding:12px;border-radius:10px;font-weight:700}.nav.active,.nav:hover{background:#141a23;color:#fff}.rail-bottom{margin-top:auto}.sandbox-note{padding:13px;border:1px solid #4b422b;border-radius:12px;background:#17150f;margin-bottom:10px}.sandbox-note strong,.sandbox-note span{display:block}.sandbox-note strong{font-size:12px;color:var(--accent)}.sandbox-note span{font-size:10px;color:#a49a7f;margin-top:4px;line-height:1.4}.workspace{padding:34px;max-width:1260px;width:100%;margin:0 auto}.workspace-head,.section-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.workspace-head h2{font-size:34px;margin:8px 0 24px;letter-spacing:-.03em}.hero-balance{padding:28px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(135deg,#151a22,#0e1218);margin-bottom:28px}.hero-balance span,.hero-balance small{display:block;color:var(--muted)}.hero-balance strong{display:block;font-size:56px;letter-spacing:-.05em;margin:10px 0}.hero-balance small{font-size:11px}.section-head h3,.panel h3{margin:8px 0 14px}.account-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.account-card,.panel{border:1px solid var(--line);border-radius:16px;background:var(--panel);padding:18px}.account-card{cursor:pointer}.account-card:hover{border-color:#4b5668}.account-card .balance{font-size:28px;font-weight:850;margin:18px 0 5px}.account-id{color:var(--muted);font-size:11px;overflow-wrap:anywhere}.muted{color:var(--muted);font-size:12px}.activity-row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:15px 0;border-bottom:1px solid var(--line)}.activity-row:last-child{border-bottom:0}.credit{color:#6de7a6}.debit{color:#f0bd7e}.owner-badge{padding:6px 9px;border-radius:999px;border:1px solid #66552e;color:var(--accent);font-size:10px;letter-spacing:.15em}.owner-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:16px 0 20px}.owner-metrics>div{border:1px solid #463c25;border-radius:15px;background:linear-gradient(145deg,#17150f,#10141b);padding:18px}.owner-metrics span{display:block;color:var(--muted);font-size:11px}.owner-metrics strong{display:block;font-size:26px;margin-top:7px}.owner-panel,.compliance-panel{border-color:#463c25}.compliance-panel{margin-bottom:18px}.compliance-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.compliance-grid>div{padding:13px;border:1px solid var(--line);border-radius:12px;background:#0b0f14}.compliance-grid span{display:block;color:var(--muted);font-size:10px}.compliance-grid strong{display:block;margin-top:5px;font-size:14px}.lock-badge{padding:6px 9px;border-radius:999px;background:#21120f;border:1px solid #6e3e34;color:#f1a394;font-size:9px;letter-spacing:.12em;font-weight:800}.control-list{display:grid;gap:7px}.control-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--line);font-size:11px}.control-row span{color:var(--muted)}.control-row strong.approved{color:#6de7a6}.control-row strong.pending{color:#f4d27a}.lock-note{margin-top:15px;padding:12px;border-radius:11px;background:#15100e;border:1px solid #51372f;color:#c8b2aa;font-size:11px}.lock-note strong{color:#f1a394}@media(max-width:780px){.topbar{padding:0 16px}#app{grid-template-columns:1fr}.rail{border-right:0;border-bottom:1px solid var(--line)}.rail nav{grid-template-columns:repeat(3,1fr);margin-top:14px}.nav{text-align:center}.rail-bottom{display:none}.workspace{padding:20px}.workspace-head{align-items:flex-start}.hero-balance strong{font-size:44px}.owner-metrics,.compliance-grid{grid-template-columns:1fr}}`;
}

export function bankConsoleJs(){
  return `(()=>{
const $=(id)=>document.getElementById(id);
let csrf="";let me=null;let accounts=[];let selectedAccount=null;let ownerOverview=null;

function money(minor){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((Number(minor)||0)/100)}
function msg(id,value){$(id).textContent=value||""}
async function request(path,options={}){
  const headers={"content-type":"application/json",...(options.headers||{})};
  if(options.csrf)headers["x-bank-csrf"]=csrf;
  const response=await fetch(path,{
    method:options.method||"GET",
    headers,
    credentials:"same-origin",
    body:options.body===undefined?undefined:JSON.stringify(options.body)
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||("HTTP "+response.status));
  return body;
}
function showView(name){
  for(const node of document.querySelectorAll(".view"))node.hidden=true;
  $(name+"View").hidden=false;
  for(const button of document.querySelectorAll(".nav"))button.classList.toggle("active",button.dataset.view===name);
}
function accountOption(account){
  const option=document.createElement("option");
  option.value=account.id;
  option.textContent=account.id+" · "+money(account.balanceMinor);
  return option;
}
function renderAccounts(){
  $("accounts").textContent="";
  $("fromAccount").textContent="";
  $("statementAccount").textContent="";
  let total=0;
  for(const account of accounts){
    total+=account.balanceMinor;
    const card=document.createElement("article");card.className="account-card";
    const tag=document.createElement("div");tag.className="eyebrow";tag.textContent="SANDBOX ACCOUNT";
    const balance=document.createElement("div");balance.className="balance";balance.textContent=money(account.balanceMinor);
    const id=document.createElement("div");id.className="account-id";id.textContent=account.id;
    card.append(tag,balance,id);
    card.onclick=()=>{selectedAccount=account.id;$("statementAccount").value=account.id;loadStatement().then(()=>showView("activity")).catch(e=>msg("statementMeta",e.message))};
    $("accounts").appendChild(card);
    $("fromAccount").appendChild(accountOption(account));
    $("statementAccount").appendChild(accountOption(account));
  }
  $("totalBalance").textContent=money(total);
  if(!accounts.length){
    const empty=document.createElement("div");empty.className="panel muted";empty.textContent="No sandbox accounts yet.";
    $("accounts").appendChild(empty);
  }
  if(!selectedAccount&&accounts[0])selectedAccount=accounts[0].id;
}
async function refreshAccounts(){
  const data=await request("/v1/accounts");
  accounts=data.accounts||[];
  renderAccounts();
}
async function refreshCompliance(){
  const data=await request("/v1/admin/compliance");
  const evidence=data.evidence||{};
  const entries=Object.entries(evidence);
  $("approvedControls").textContent=String(entries.filter(([,value])=>value.status==="approved").length);
  $("complianceBlockers").textContent=String(data.readiness?.blockers?.length||0);
  $("complianceProvider").textContent=data.provider?.id||"Not set";
  $("complianceRecon").textContent=data.latestReconciliation?(data.latestReconciliation.ok?"Clean":"Exception"):"None";
  $("complianceState").textContent="LIVE MONEY LOCKED";
  $("complianceList").textContent="";
  for(const [name,value] of entries.sort(([a],[b])=>a.localeCompare(b))){
    const row=document.createElement("div");row.className="control-row";
    const label=document.createElement("span");label.textContent=name;
    const state=document.createElement("strong");state.className=value.status==="approved"?"approved":"pending";state.textContent=value.status.toUpperCase();
    row.append(label,state);$("complianceList").appendChild(row);
  }
  if(!entries.length)$("complianceList").textContent="No reviewed compliance evidence recorded yet.";
}
async function refreshOwner(){
  try{
    const data=await request("/v1/admin/overview");
    ownerOverview=data;
    $("ownerNav").hidden=false;
    $("ownerAccountCount").textContent=String(data.accountCount);
    $("ownerCustomerCount").textContent=String(data.customerCount);
    $("ownerLiabilities").textContent=money(data.totalCustomerBalanceMinor);
    $("ownerFundAccount").textContent="";
    for(const account of data.accounts||[])$("ownerFundAccount").appendChild(accountOption(account));
    await refreshCompliance();
    return true;
  }catch(error){
    if(error.message==="forbidden"||error.message==="unauthorized"){
      ownerOverview=null;
      $("ownerNav").hidden=true;
      return false;
    }
    throw error;
  }
}
async function bootstrap(){
  const session=await request("/v1/session/csrf");
  csrf=session.csrfToken;
  me=session.user;
  $("userEmail").textContent=me.email||me.id;
  $("loginPanel").hidden=true;$("app").hidden=false;
  await refreshAccounts();
  await refreshOwner();
}
async function loadStatement(){
  const accountId=$("statementAccount").value||selectedAccount;
  if(!accountId)return;
  selectedAccount=accountId;
  const data=await request("/v1/accounts/"+encodeURIComponent(accountId)+"/statement");
  const statement=data.statement;
  $("statementMeta").textContent=statement.accountId+" · "+money(statement.balanceMinor);
  $("activity").textContent="";
  for(const entry of [...statement.entries].reverse()){
    const row=document.createElement("div");row.className="activity-row";
    const left=document.createElement("div");
    const title=document.createElement("strong");title.textContent=entry.reference;
    const meta=document.createElement("div");meta.className="muted";meta.textContent="#"+entry.sequence+" · "+entry.currency;
    left.append(title,meta);
    const amount=document.createElement("strong");amount.className=entry.side==="CREDIT"?"credit":"debit";
    amount.textContent=(entry.side==="CREDIT"?"+":"-")+money(entry.amountMinor);
    row.append(left,amount);$("activity").appendChild(row);
  }
  if(!statement.entries.length)$("activity").textContent="No activity yet.";
}
$("login").onclick=async()=>{
  try{
    msg("loginStatus","Signing in…");
    const data=await request("/v1/session",{method:"POST",body:{email:$("email").value.trim(),password:$("password").value}});
    csrf=data.csrfToken;
    await bootstrap();
    $("password").value="";
    msg("loginStatus","");
  }catch(error){msg("loginStatus",error.message)}
};
$("logout").onclick=async()=>{
  try{await request("/v1/session",{method:"DELETE",csrf:true});location.reload()}
  catch(error){alert(error.message)}
};
$("newAccount").onclick=async()=>{
  try{
    await request("/v1/accounts",{method:"POST",csrf:true,body:{}});
    await refreshAccounts();
    showView("overview");
  }catch(error){alert(error.message)}
};
$("refreshAccounts").onclick=()=>refreshAccounts().catch(e=>alert(e.message));
$("sendTransfer").onclick=async()=>{
  try{
    const amountText=$("amount").value.trim();
    const amount=Math.round(Number(amountText)*100);
    if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("Enter a valid positive amount.");
    msg("transferStatus","Sending…");
    const data=await request("/v1/transfers",{method:"POST",csrf:true,body:{
      fromAccountId:$("fromAccount").value,
      toAccountId:$("toAccount").value.trim(),
      amountMinor:amount,
      idempotencyKey:"web_"+crypto.randomUUID(),
      reference:$("reference").value.trim()||"sandbox transfer"
    }});
    msg("transferStatus","Transfer complete. New balance: "+money(data.from.balanceMinor));
    $("amount").value="";$("reference").value="";
    await refreshAccounts();
  }catch(error){msg("transferStatus",error.message)}
};
$("statementAccount").onchange=()=>loadStatement().catch(e=>msg("statementMeta",e.message));
$("ownerFund").onclick=async()=>{
  try{
    const amount=Math.round(Number($("ownerFundAmount").value.trim())*100);
    if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("Enter a valid positive amount.");
    const accountId=$("ownerFundAccount").value;
    if(!accountId)throw new Error("Select a customer account.");
    await request("/v1/admin/fund-sandbox",{method:"POST",csrf:true,body:{
      accountId,
      amountMinor:amount,
      idempotencyKey:"owner_web_"+crypto.randomUUID()
    }});
    $("ownerFundAmount").value="";
    msg("ownerStatus","Sandbox funds added.");
    await Promise.all([refreshOwner(),refreshAccounts()]);
  }catch(error){msg("ownerStatus",error.message)}
};
for(const button of document.querySelectorAll(".nav"))button.onclick=async()=>{
  const view=button.dataset.view;
  showView(view);
  if(view==="activity")await loadStatement().catch(e=>msg("statementMeta",e.message));
  if(view==="owner")await refreshOwner().catch(e=>msg("ownerStatus",e.message));
};
fetch("/health").then(r=>r.json()).then(data=>$("health").textContent=data.ok?"Financial core online":"Financial core unavailable").catch(()=>$("health").textContent="Financial core unavailable");
bootstrap().catch(()=>{});
})();`;
}

export function bankConsoleAsset(pathname){
  if(pathname==="/"||pathname==="/console")return {type:"text/html; charset=utf-8",body:bankConsoleHtml()};
  if(pathname==="/bank-console.css")return {type:"text/css; charset=utf-8",body:bankConsoleCss()};
  if(pathname==="/bank-console.js")return {type:"text/javascript; charset=utf-8",body:bankConsoleJs()};
  return null;
}
