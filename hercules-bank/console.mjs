export function bankConsoleHtml() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hercules Bank</title><link rel="stylesheet" href="/bank-console.css">
</head><body>
<div class="shell">
<header class="topbar">
  <div class="brand"><div class="mark">H</div><div><strong>HERCULES BANK</strong><span>Financial Core</span></div></div>
  <div class="top-actions"><span class="pill sandbox">SANDBOX</span><span id="health" class="status">Checking core…</span></div>
</header>
<main>
<section id="accessPanel" class="access-card">
  <div class="eyebrow">Secure access</div>
  <h1>Your money command center.</h1>
  <p>Open Hercules Bank from an authenticated Hercules session. Sandbox balances are test value only.</p>
  <label>Temporary access token<input id="tokenInput" type="password" autocomplete="off" placeholder="Paste a Hercules access token"></label>
  <div class="row"><button id="connect">Connect session</button></div>
  <div id="accessStatus" class="message"></div>
</section>

<section id="bankApp" hidden>
  <div class="hero-grid">
    <section class="balance-card">
      <div class="eyebrow">Available balance</div>
      <div id="balance" class="balance">$0.00</div>
      <div class="account-line"><span id="accountLabel">No account selected</span><span class="pill">USD</span></div>
      <div class="row"><button id="openAccount">Open sandbox account</button><button id="refresh" class="ghost">Refresh</button></div>
    </section>
    <section class="signal-card">
      <div class="eyebrow">Hercules protection</div>
      <h2>Ledger verified</h2>
      <p>Double-entry accounting, overdraft protection, idempotency, and tamper-evident journal controls are active.</p>
      <div class="signal-row"><span>External rails</span><strong>LOCKED</strong></div>
      <div class="signal-row"><span>Mode</span><strong>SANDBOX</strong></div>
    </section>
  </div>

  <div class="layout">
    <aside class="sidebar">
      <div class="section-title"><span>Accounts</span><span id="accountCount">0</span></div>
      <div id="accounts" class="account-list"></div>
    </aside>

    <section class="content">
      <div class="content-grid">
        <section class="panel">
          <div class="eyebrow">Send funds</div>
          <h2>Internal transfer</h2>
          <label>From<select id="fromAccount"></select></label>
          <label>To account ID<input id="toAccount" autocomplete="off" placeholder="acct_…"></label>
          <label>Amount<input id="amount" inputmode="decimal" placeholder="0.00"></label>
          <label>Note<input id="reference" maxlength="120" placeholder="What is this for?"></label>
          <button id="send">Send sandbox funds</button>
          <div id="transferStatus" class="message"></div>
        </section>

        <section class="panel">
          <div class="section-title"><div><div class="eyebrow">Activity</div><h2>Transaction history</h2></div><button id="refreshHistory" class="ghost small">Refresh</button></div>
          <div id="history" class="history"><div class="empty">Select an account to view activity.</div></div>
        </section>
      </div>

      <section id="ownerPanel" class="panel owner" hidden>
        <div class="section-title"><div><div class="eyebrow">Owner controls</div><h2>Sandbox control center</h2></div><span class="pill owner-pill">OWNER</span></div>
        <div class="metrics">
          <div><span>Customer accounts</span><strong id="adminAccounts">0</strong></div>
          <div><span>Customers</span><strong id="adminCustomers">0</strong></div>
          <div><span>Sandbox liabilities</span><strong id="adminBalance">$0.00</strong></div>
        </div>
        <div class="fund-grid">
          <label>Account<select id="fundAccount"></select></label>
          <label>Sandbox amount<input id="fundAmount" inputmode="decimal" placeholder="100.00"></label>
          <button id="fund">Add sandbox funds</button>
        </div>
        <div id="adminStatus" class="message"></div>
      </section>
    </section>
  </div>
</section>
</main>
<footer>Hercules Bank · Sandbox financial software · No real deposits, ACH, wires, or cards enabled.</footer>
</div><script src="/bank-console.js" defer></script></body></html>`;
}

export function bankConsoleCss() {
  return `:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#06080b;color:#f4f7fb;--panel:#0d1218;--panel2:#111821;--line:#202c38;--muted:#8593a3;--gold:#e9bf6a;--green:#7ce0a3}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% -10%,#172333 0,#06080b 38%);min-height:100vh}.shell{min-height:100vh;display:flex;flex-direction:column}.topbar{height:76px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #19222c;background:rgba(6,8,11,.86);backdrop-filter:blur(16px);position:sticky;top:0;z-index:4}.brand{display:flex;align-items:center;gap:12px}.brand strong{display:block;letter-spacing:.14em;font-size:13px}.brand span{display:block;color:var(--muted);font-size:11px;margin-top:3px}.mark{width:38px;height:38px;border:1px solid #6b5630;border-radius:11px;display:grid;place-items:center;font-family:Georgia,serif;color:var(--gold);font-size:20px;background:linear-gradient(145deg,#17130d,#0d1014)}.top-actions{display:flex;gap:12px;align-items:center}.pill{font-size:10px;letter-spacing:.12em;padding:7px 9px;border:1px solid #2a3948;border-radius:999px;color:#b9c4cf}.sandbox{color:var(--gold);border-color:#6a5330;background:#1a140b}.status{font-size:12px;color:var(--muted)}main{width:min(1240px,100%);margin:0 auto;padding:30px 24px;flex:1}.access-card{max-width:560px;margin:8vh auto;background:linear-gradient(145deg,#111821,#0a0f15);border:1px solid #23303d;border-radius:24px;padding:34px;box-shadow:0 30px 80px rgba(0,0,0,.35)}h1{font-size:42px;line-height:1.04;margin:8px 0 14px;letter-spacing:-.04em}h2{font-size:20px;margin:7px 0 16px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:10px;color:var(--gold);font-weight:800}p{color:#9cabb9;line-height:1.6}label{display:block;color:#93a0ad;font-size:12px;margin:14px 0}input,select{width:100%;margin-top:7px;background:#080c11;border:1px solid #263442;color:#fff;border-radius:11px;padding:12px 13px;outline:none}input:focus,select:focus{border-color:#80683d;box-shadow:0 0 0 3px rgba(233,191,106,.08)}button{border:0;border-radius:11px;padding:11px 15px;background:#f1d08c;color:#15120c;font-weight:800;cursor:pointer}button:hover{filter:brightness(1.06)}button.ghost{background:#111820;color:#dbe4ec;border:1px solid #2b3946}button.small{padding:8px 10px;font-size:11px}.row{display:flex;gap:10px;align-items:center;margin-top:16px}.hero-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:18px;margin-bottom:18px}.balance-card,.signal-card,.panel,.sidebar{background:linear-gradient(145deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:20px}.balance-card,.signal-card{padding:26px}.balance{font-size:54px;font-weight:800;letter-spacing:-.055em;margin:8px 0 4px}.account-line{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:12px}.signal-row{display:flex;justify-content:space-between;border-top:1px solid #202b36;padding:12px 0;font-size:12px;color:var(--muted)}.signal-row strong{color:var(--green);font-size:11px;letter-spacing:.12em}.layout{display:grid;grid-template-columns:250px 1fr;gap:18px}.sidebar{padding:16px}.section-title{display:flex;justify-content:space-between;align-items:center;gap:12px}.account-list{margin-top:12px}.account-item{padding:12px;border:1px solid transparent;border-radius:12px;cursor:pointer;margin:6px 0}.account-item:hover,.account-item.active{background:#141d26;border-color:#283746}.account-item strong{display:block;font-size:13px}.account-item span{font-size:11px;color:var(--muted)}.content-grid{display:grid;grid-template-columns:.9fr 1.4fr;gap:18px}.panel{padding:22px}.history{min-height:290px}.tx{display:grid;grid-template-columns:1fr auto;gap:10px;padding:12px 0;border-bottom:1px solid #202b36}.tx strong{font-size:13px}.tx span{display:block;color:var(--muted);font-size:11px;margin-top:4px}.tx-amount{font-weight:800}.credit{color:var(--green)}.debit{color:#f3a2a2}.empty{color:var(--muted);padding:28px 0;text-align:center}.owner{margin-top:18px;border-color:#4c3b21}.owner-pill{color:var(--gold);border-color:#65502e}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.metrics>div{background:#090e13;border:1px solid #202b36;border-radius:14px;padding:15px}.metrics span{display:block;color:var(--muted);font-size:11px}.metrics strong{display:block;font-size:24px;margin-top:6px}.fund-grid{display:grid;grid-template-columns:1.5fr 1fr auto;align-items:end;gap:10px}.message{min-height:20px;color:#a8b4c0;font-size:12px;margin-top:10px}footer{text-align:center;color:#667482;font-size:11px;padding:24px;border-top:1px solid #151d25}@media(max-width:900px){.hero-grid,.content-grid{grid-template-columns:1fr}.layout{grid-template-columns:1fr}.sidebar{order:2}.content{order:1}.metrics{grid-template-columns:1fr}.fund-grid{grid-template-columns:1fr}.balance{font-size:44px}}@media(max-width:560px){.topbar{padding:0 16px}.status{display:none}main{padding:18px 12px}.access-card{padding:24px;margin:4vh auto}.balance-card,.signal-card,.panel{padding:18px}h1{font-size:34px}}`;
}

export function bankConsoleJs() {
  return `(() => {
const $=(id)=>document.getElementById(id);
let accessToken="";let accounts=[];let selectedId="";
const money=(minor,currency="USD")=>new Intl.NumberFormat("en-US",{style:"currency",currency}).format((Number(minor)||0)/100);
const status=(id,value)=>$(id).textContent=value||"";
function fragmentToken(){
  const raw=location.hash.startsWith("#")?location.hash.slice(1):"";
  const params=new URLSearchParams(raw);
  const token=params.get("access_token")||"";
  if(raw)history.replaceState(null,"",location.pathname+location.search);
  return token;
}
async function api(path,options={}){
  if(!accessToken)throw new Error("Open Hercules Bank from an authenticated Hercules session.");
  const headers={accept:"application/json",authorization:"Bearer "+accessToken};
  if(options.body!==undefined)headers["content-type"]="application/json";
  const response=await fetch(path,{method:options.method||"GET",headers,body:options.body===undefined?undefined:JSON.stringify(options.body),cache:"no-store",redirect:"error"});
  const body=await response.json().catch(()=>({error:"Invalid Hercules Bank response"}));
  if(!response.ok)throw Object.assign(new Error(body.error||("HTTP "+response.status)),{statusCode:response.status});
  return body;
}
function renderAccounts(){
  $("accountCount").textContent=String(accounts.length);$("accounts").innerHTML="";$("fromAccount").innerHTML="";$("fundAccount").innerHTML="";
  for(const account of accounts){
    const item=document.createElement("div");item.className="account-item"+(account.id===selectedId?" active":"");
    const masked=account.id.length>14?"•••• "+account.id.slice(-8):account.id;
    item.innerHTML="<strong>"+masked+"</strong><span>"+money(account.balanceMinor,account.currency)+" · "+account.status+"</span>";
    item.onclick=()=>selectAccount(account.id);$("accounts").appendChild(item);
    const option=document.createElement("option");option.value=account.id;option.textContent=masked+" — "+money(account.balanceMinor,account.currency);$("fromAccount").appendChild(option);
    const fundOption=option.cloneNode(true);$("fundAccount").appendChild(fundOption);
  }
  if(!accounts.length)$("accounts").innerHTML='<div class="empty">No accounts yet.</div>';
}
async function refreshAccounts(){
  const data=await api("/v1/accounts");accounts=data.accounts||[];
  if(selectedId&&!accounts.some(a=>a.id===selectedId))selectedId="";
  if(!selectedId&&accounts[0])selectedId=accounts[0].id;
  renderAccounts();
  if(selectedId)await selectAccount(selectedId);else{$("balance").textContent="$0.00";$("accountLabel").textContent="No account selected";}
  await refreshAdmin();
}
async function selectAccount(id){
  selectedId=id;renderAccounts();
  const account=accounts.find(a=>a.id===id)||await api("/v1/accounts/"+encodeURIComponent(id)).then(x=>x.account);
  $("balance").textContent=money(account.balanceMinor,account.currency);$("accountLabel").textContent=account.id;$("fromAccount").value=id;
  await refreshHistory();
}
async function refreshHistory(){
  if(!selectedId){$("history").innerHTML='<div class="empty">Select an account to view activity.</div>';return}
  const data=await api("/v1/accounts/"+encodeURIComponent(selectedId)+"/statement");const statement=data.statement;
  $("history").innerHTML="";
  for(const entry of [...statement.entries].reverse()){
    const row=document.createElement("div");row.className="tx";
    const left=document.createElement("div");const title=document.createElement("strong");title.textContent=entry.reference||"Transaction";
    const meta=document.createElement("span");meta.textContent="#"+entry.sequence+" · "+entry.currency;left.append(title,meta);
    const amount=document.createElement("div");amount.className="tx-amount "+(entry.side==="CREDIT"?"credit":"debit");amount.textContent=(entry.side==="CREDIT"?"+":"−")+money(entry.amountMinor,entry.currency);
    row.append(left,amount);$("history").appendChild(row);
  }
  if(!statement.entries.length)$("history").innerHTML='<div class="empty">No transactions yet.</div>';
}
async function refreshAdmin(){
  try{
    const data=await api("/v1/admin/overview");$("ownerPanel").hidden=false;
    $("adminAccounts").textContent=String(data.accountCount);$("adminCustomers").textContent=String(data.customerCount);$("adminBalance").textContent=money(data.totalCustomerBalanceMinor,data.currency);
  }catch(error){if(error.statusCode===403){$("ownerPanel").hidden=true;return}throw error}
}
async function connect(token){
  accessToken=String(token||"").trim();if(!accessToken)throw new Error("A Hercules access token is required.");
  await refreshAccounts();$("accessPanel").hidden=true;$("bankApp").hidden=false;$("tokenInput").value="";
}
$("connect").onclick=()=>connect($("tokenInput").value).catch(e=>status("accessStatus",e.message));
$("openAccount").onclick=async()=>{try{await api("/v1/accounts",{method:"POST",body:{}});await refreshAccounts()}catch(e){status("transferStatus",e.message)}};
$("refresh").onclick=()=>refreshAccounts().catch(e=>status("transferStatus",e.message));
$("refreshHistory").onclick=()=>refreshHistory().catch(e=>status("transferStatus",e.message));
$("send").onclick=async()=>{try{
  const amount=Math.round(Number($("amount").value)*100);if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("Enter a valid amount.");
  const toAccountId=$("toAccount").value.trim();if(!toAccountId)throw new Error("Destination account ID is required.");
  await api("/v1/transfers",{method:"POST",body:{fromAccountId:$("fromAccount").value,toAccountId,amountMinor:amount,idempotencyKey:"ui_"+crypto.randomUUID(),reference:$("reference").value.trim()||"Hercules Bank transfer"}});
  $("amount").value="";$("reference").value="";status("transferStatus","Transfer posted.");await refreshAccounts();
}catch(e){status("transferStatus",e.message)}};
$("fund").onclick=async()=>{try{
  const amount=Math.round(Number($("fundAmount").value)*100);if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("Enter a valid sandbox amount.");
  await api("/v1/admin/fund-sandbox",{method:"POST",body:{accountId:$("fundAccount").value,amountMinor:amount,idempotencyKey:"admin_ui_"+crypto.randomUUID()}});
  $("fundAmount").value="";status("adminStatus","Sandbox funds added.");await refreshAccounts();
}catch(e){status("adminStatus",e.message)}};
fetch("/health",{cache:"no-store"}).then(r=>r.json()).then(d=>$("health").textContent=d.ok?"Core online · "+d.currency:"Core unavailable").catch(()=>$("health").textContent="Core unavailable");
const initial=fragmentToken();if(initial)connect(initial).catch(e=>status("accessStatus",e.message));
})();`;
}

export function bankConsoleAsset(pathname) {
  if(pathname==="/"||pathname==="/console")return {type:"text/html; charset=utf-8",body:bankConsoleHtml()};
  if(pathname==="/bank-console.css")return {type:"text/css; charset=utf-8",body:bankConsoleCss()};
  if(pathname==="/bank-console.js")return {type:"text/javascript; charset=utf-8",body:bankConsoleJs()};
  return null;
}
