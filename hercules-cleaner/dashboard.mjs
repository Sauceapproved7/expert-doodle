export function renderDashboard({token}) {
  const safeToken = JSON.stringify(String(token));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hercules Cleaner</title>
<style>
:root{color-scheme:dark;--bg:#090b0f;--panel:#11151b;--line:#262d37;--text:#f4f6f8;--muted:#9da8b6;--gold:#d8ad5c;--green:#63d48c}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% -10%,#2d2618 0,transparent 30%),var(--bg);color:var(--text);font:15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}
.shell{max-width:1180px;margin:auto;padding:34px}.top{display:flex;justify-content:space-between;gap:24px;align-items:center}.brand{display:flex;align-items:center;gap:14px}
.mark{width:48px;height:48px;border:1px solid #6d5933;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#2c2518,#101217);font-weight:900;color:var(--gold);font-size:22px;box-shadow:0 12px 40px #0008}
.eyebrow{color:var(--gold);font-size:11px;letter-spacing:.2em;font-weight:800}.title{font-size:27px;font-weight:800;letter-spacing:-.03em}.pill{border:1px solid #2d4937;background:#102017;color:var(--green);padding:7px 11px;border-radius:999px;font-size:12px}
.hero{margin:30px 0 18px;padding:28px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(135deg,#14171d,#0e1014);display:grid;grid-template-columns:1.3fr .7fr;gap:20px}
.hero h1{font-size:40px;line-height:1.05;margin:8px 0 12px;letter-spacing:-.05em}.hero p{color:var(--muted);max-width:650px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
button{border:0;border-radius:12px;padding:12px 16px;font-weight:800;cursor:pointer}.primary{background:var(--gold);color:#17130c}.secondary{background:#1a1e25;color:var(--text);border:1px solid #303641}
.meter{display:grid;place-items:center;min-height:210px}.ring{width:170px;height:170px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--gold) 0 78%,#252933 78%);position:relative}.ring:after{content:"";position:absolute;inset:13px;border-radius:50%;background:#11141a}.ring div{z-index:1;text-align:center}.ring strong{font-size:32px;display:block}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px}.card h3{margin:0 0 5px;font-size:14px}.muted{color:var(--muted)}.metric{font-size:25px;font-weight:850;margin-top:14px}.wide{grid-column:span 2}
.log{white-space:pre-wrap;background:#0c0e12;border:1px solid #20252e;border-radius:14px;padding:14px;min-height:120px;max-height:300px;overflow:auto;color:#cbd3dd;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}
.session-row{display:flex;gap:8px;margin-top:12px}.session-row input{flex:1;background:#0c0e12;border:1px solid #303641;color:var(--text);padding:11px 12px;border-radius:10px}
.schedule{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}@media(max-width:800px){.hero{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.shell{padding:20px}.hero h1{font-size:32px}}
</style></head><body><main class="shell">
<div class="top"><div class="brand"><div class="mark">H</div><div><div class="eyebrow">SAUCEAPPROVED</div><div class="title">Hercules Cleaner</div></div></div><div class="pill">LOCAL-FIRST · RECOVERY ON</div></div>
<section class="hero"><div><div class="eyebrow">CONTROL THE CLEAN</div><h1>Strong cleanup.<br>Nothing blind.</h1><p>Scan approved zones, clean on your schedule, track work sessions, and route removals through Recovery Capsules before permanent purge.</p><div class="actions"><button class="primary" onclick="cleanNow()">Clean Computer</button><button class="secondary" onclick="scanNow()">Preview Scan</button><button class="secondary" onclick="refresh()">Refresh Status</button></div></div><div class="meter"><div class="ring"><div><strong id="score">SAFE</strong><span class="muted">policy mode</span></div></div></div></section>
<section class="grid">
<article class="card"><h3>Last cleanup</h3><div class="metric" id="last">Never</div><div class="muted">Profile-aware history</div></article>
<article class="card"><h3>Recovery Capsules</h3><div class="metric" id="capsules">0</div><div class="muted">Restorable cleanup batches</div></article>
<article class="card"><h3>Active Sessions</h3><div class="metric" id="sessions">0</div><div class="muted">Session Clean tracking</div></article>
<article class="card wide"><h3>Work Session</h3><div class="muted">Track a work session and clean only approved disposable artifacts created during it.</div><div class="session-row"><input id="label" value="Work Session"><button class="secondary" onclick="startSession()">Start</button><button class="secondary" onclick="stopSession()">Stop + Clean</button></div></article>
<article class="card"><h3>Automation</h3><div class="metric" id="profile">—</div><div class="schedule"><button class="secondary" onclick="schedule('daily')">Daily</button><button class="secondary" onclick="schedule('everyNDays',2)">Every 2 Days</button><button class="secondary" onclick="schedule('weekly')">Weekly</button></div></article>
<article class="card" style="grid-column:1/-1"><h3>Evidence Log</h3><div id="log" class="log">Ready.</div></article>
</section></main><script>
const TOKEN=${safeToken};let activeSession=null;
async function api(path,method="GET",body){const res=await fetch(path,{method,headers:{"content-type":"application/json","x-hercules-token":TOKEN},body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw new Error(data.error||"Request failed");return data}
function bytes(n){if(!Number.isFinite(n))return "0 B";const u=["B","KB","MB","GB","TB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return n.toFixed(i?1:0)+" "+u[i]}
function out(v){document.getElementById("log").textContent=typeof v==="string"?v:JSON.stringify(v,null,2)}
async function refresh(){try{const s=await api("/api/status");document.getElementById("profile").textContent=s.activeProfileId;document.getElementById("capsules").textContent=s.recoveryCapsules.length;document.getElementById("sessions").textContent=s.activeSessions.length;activeSession=s.activeSessions[0]?.id||null;const runs=Object.values(s.lastRuns||{}).sort((a,b)=>b-a);document.getElementById("last").textContent=runs.length?new Date(runs[0]).toLocaleString():"Never";out(s)}catch(e){out(e.message)}}
async function scanNow(){try{const p=await api("/api/scan","POST",{});out({candidates:p.candidates.length,reclaimable:bytes(p.reclaimableBytes),skipped:p.skipped.length,mode:p.executionMode})}catch(e){out(e.message)}}
async function cleanNow(){try{const r=await api("/api/clean","POST",{});out({cleaned:r.cleanedFiles,reclaimed:bytes(r.reclaimedBytes),capsule:r.capsule.id});await refresh()}catch(e){out(e.message)}}
async function startSession(){try{const r=await api("/api/session/start","POST",{label:document.getElementById("label").value});activeSession=r.id;out(r);await refresh()}catch(e){out(e.message)}}
async function stopSession(){try{if(!activeSession)throw new Error("No active work session");const r=await api("/api/session/stop","POST",{sessionId:activeSession});activeSession=null;out(r);await refresh()}catch(e){out(e.message)}}
async function schedule(type,days){try{const schedule={type,enabled:true};if(type==="everyNDays")schedule.days=days;out(await api("/api/schedule","POST",{profileId:"quick-safe",schedule}));await refresh()}catch(e){out(e.message)}}
refresh();
</script></body></html>`;
}
