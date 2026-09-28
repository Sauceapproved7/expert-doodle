import {createServer} from "node:http";
import {pathToFileURL} from "node:url";
import {inspectLaunchRunStateFile} from "./run-status.mjs";
import {buildStudioViewModel,createStudioManifest} from "./studio-contract.mjs";

const JSON_HEADERS=Object.freeze({
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff"
});
const HTML_HEADERS=Object.freeze({
  "content-type":"text/html; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff",
  "content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"
});

function json(body,status=200) {
  return {status,headers:JSON_HEADERS,body:JSON.stringify(body)};
}

function humanize(value) {
  return String(value || "").replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function statusBadge(label,value,tone="neutral") {
  return `<div class="metric ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderTimeline(model) {
  if (!model?.timeline?.length) return '<p class="muted">No verified shots loaded.</p>';
  return model.timeline.map(shot=>`
    <article class="shot">
      <div><b>${escapeHtml(shot.shotId)}</b><span>${escapeHtml(shot.status)}</span></div>
      <div class="chips">
        <em>${shot.evaluationBound ? "EVIDENCE BOUND" : "EVIDENCE PENDING"}</em>
        <em>${shot.safelyReusable ? "REUSABLE" : shot.requiresResubmission ? "RESUBMIT" : "HELD"}</em>
      </div>
    </article>`).join("");
}

function renderStudioShell({manifest,model,bridge}) {
  const bridgeConnected=bridge?.connected===true;
  const bridgeLabel=bridgeConnected ? "Execution bridge connected" : "Execution bridge unavailable";
  const stage=model?.launchStage || "no verified run";
  const completed=model?.counts?.completed || 0;
  const shots=model?.counts?.shots || 0;
  const evaluated=model?.counts?.evaluated || 0;
  const integrity=model?.integrity?.ok===true;
  const mode=model?.mode || "read-only";
  const surfaces=new Map(manifest.surfaces.map(surface=>[surface.id,surface.label]));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>SauceApproved Studio</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#070707;color:#f5f5f5}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#252020 0,#0b0b0b 34%,#050505 72%);min-height:100vh}
main{width:min(1180px,100%);margin:auto;padding:24px}.top{display:grid;gap:18px;padding:28px;border:1px solid #292929;border-radius:28px;background:linear-gradient(145deg,#161616,#0c0c0c);box-shadow:0 28px 90px #0008}
.eyebrow{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#aaa}.title{font-size:clamp(34px,8vw,72px);line-height:.95;margin:0;font-weight:900}.accent{color:#d9b0a8}
.sub{max-width:760px;color:#bdbdbd;line-height:1.6}.rail{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.metric{padding:14px;border:1px solid #262626;border-radius:16px;background:#0d0d0d}.metric span{display:block;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.metric strong{display:block;margin-top:5px}.metric.good strong{color:#8ef0b0}.metric.warn strong{color:#f1cb7c}
.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;margin-top:18px}.card{border:1px solid #272727;border-radius:22px;background:#0d0d0de8;padding:20px}.card h2{margin:0 0 5px;font-size:18px}.card p{margin:6px 0;color:#999;line-height:1.5}.stack{display:grid;gap:12px}.shot{padding:14px;border:1px solid #232323;border-radius:16px;background:#101010}.shot>div:first-child{display:flex;justify-content:space-between;gap:12px}.shot span{color:#aaa}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.chips em{font-style:normal;font-size:10px;letter-spacing:.08em;border:1px solid #333;padding:6px 8px;border-radius:999px;color:#bdbdbd}
.actions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.button{border:1px solid #2c2c2c;background:#111;padding:14px;border-radius:14px;color:#777;font-weight:800;text-align:center}.button.on{background:#f2f2f2;color:#050505}.notice{padding:14px;border-radius:16px;border:1px solid #4a3423;background:#1b140e;color:#f3c991}.muted{color:#777!important}.surface-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.surface{padding:10px 12px;border:1px solid #252525;border-radius:12px;color:#bbb;background:#0a0a0a}
@media(max-width:760px){main{padding:14px}.top{padding:20px;border-radius:22px}.rail{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.actions{grid-template-columns:1fr}.surface-list{grid-template-columns:1fr}}
</style>
</head>
<body>
<main>
<section class="top">
<div><div class="eyebrow">SauceApproved / Owned Video System</div><h1 class="title">SauceApproved <span class="accent">Studio</span></h1></div>
<p class="sub">A verified operator surface for Hercules Video. Run identity, shot state, quality gates, recovery and evidence stay visible. Execution stays fail-closed until a trusted bridge is connected.</p>
<div class="rail">
${statusBadge("Mode",mode)}
${statusBadge("Run stage",stage)}
${statusBadge("Integrity",integrity ? "verified" : "blocked",integrity ? "good" : "warn")}
${statusBadge("Execution",bridgeLabel,bridgeConnected ? "good" : "warn")}
</div>
</section>

<div class="grid">
<section class="card stack">
<div><div class="eyebrow">Operator</div><h2>${escapeHtml(surfaces.get("project-brief"))}</h2><p>Capture the creative brief and prepare the run plan without pretending execution is connected.</p></div>
<div class="notice">${escapeHtml(bridgeLabel)}. Start and resume stay locked until the owned execution bridge is verified.</div>
<div class="surface-list">
${manifest.surfaces.map(surface=>`<div class="surface">${escapeHtml(surface.label)}</div>`).join("")}
</div>
<div>
<h2>${escapeHtml(surfaces.get("run-status"))}</h2>
<div class="rail">
${statusBadge("Shots",shots)}
${statusBadge("Completed",completed)}
${statusBadge("Evaluated",evaluated)}
${statusBadge("Policy",manifest.executionPolicy)}
</div>
</div>
<div>
<h2>${escapeHtml(surfaces.get("shot-timeline"))}</h2>
<div class="stack">${renderTimeline(model)}</div>
</div>
</section>

<aside class="card stack">
<div><div class="eyebrow">Trust layer</div><h2>${escapeHtml(surfaces.get("quality-evidence"))}</h2><p>Evidence coverage and final-output proof come from Hercules Video state, not UI guesses.</p></div>
${model ? statusBadge("Evidence coverage",`${model.evidence.coverage.covered}/${model.evidence.coverage.total}`,model.evidence.coverage.complete ? "good" : "warn") : statusBadge("Evidence coverage","No verified run","warn")}
${model ? statusBadge("Final output",model.evidence.finalization.closed ? "verified" : "not finalized",model.evidence.finalization.closed ? "good" : "warn") : ""}
<div><h2>${escapeHtml(surfaces.get("recovery"))}</h2><p>Resume is offered only when integrity passes and a trusted execution bridge is present.</p></div>
<div class="actions">
<div class="button ${model?.controls?.start?.enabled ? "on" : ""}">Start</div>
<div class="button ${model?.controls?.resume?.enabled ? "on" : ""}">Resume</div>
<div class="button ${model?.controls?.export?.enabled ? "on" : ""}">Export</div>
</div>
<div><h2>${escapeHtml(surfaces.get("integrations"))}</h2><p>${bridgeConnected ? "Trusted Hercules execution bridge connected." : "No trusted execution bridge connected. The Studio remains read-only."}</p></div>
</aside>
</div>
</main>
</body>
</html>`;
}

export function createStudioHttpHandler({
  statusReader=async()=>null,
  executionBridgeProvider=async()=>({connected:false,reason:"execution_bridge_unavailable"}),
  authorizeOperator=async()=>false,
  actions={}
}={}) {
  const manifest=createStudioManifest();

  async function readContext() {
    const [runStatus,bridge]=await Promise.all([statusReader(),executionBridgeProvider()]);
    const model=runStatus ? buildStudioViewModel({runStatus,executionBridge:bridge}) : null;
    return {runStatus,bridge,model};
  }

  return async function handle(request={}) {
    const {method="GET",pathname="/"}=request;
    const normalizedMethod=String(method).toUpperCase();
    const normalizedPath=String(pathname || "/").split("?")[0];

    if (normalizedMethod==="GET" && normalizedPath==="/health") {
      return json({
        ok:true,
        service:"sauceapproved-studio",
        engine:"hercules-video",
        version:"1.0.0",
        executionPolicy:"fail-closed"
      });
    }

    if (normalizedMethod==="GET" && normalizedPath==="/api/studio/manifest") {
      return json(manifest);
    }

    if (normalizedMethod==="GET" && normalizedPath==="/api/studio/status") {
      const {model}=await readContext();
      if (!model) return json({ok:false,error:"studio_run_state_unavailable"},404);
      return json(model);
    }

    if (normalizedMethod==="GET" && normalizedPath==="/") {
      const {bridge,model}=await readContext();
      return {status:200,headers:HTML_HEADERS,body:renderStudioShell({manifest,model,bridge})};
    }

    if (normalizedMethod==="POST" && (normalizedPath==="/api/studio/start" || normalizedPath==="/api/studio/resume")) {
      const actionName=normalizedPath.endsWith("/start") ? "start" : "resume";
      const {bridge,model}=await readContext();
      const reason=!model
        ? "studio_run_state_unavailable"
        : model.controls[actionName]?.reason || bridge?.reason || null;
      if (bridge?.connected!==true || model?.controls?.[actionName]?.enabled!==true) {
        return json({ok:false,error:reason || "execution_bridge_unavailable"},bridge?.connected===true ? 409 : 423);
      }
      const authorized=await authorizeOperator(request);
      if (authorized!==true) {
        return json({ok:false,error:"studio_operator_authorization_required"},401);
      }
      if (typeof actions?.[actionName]!=="function") {
        return json({ok:false,error:"execution_action_unavailable"},501);
      }
      const result=await actions[actionName]({model,bridge});
      return json({ok:true,result});
    }

    return json({ok:false,error:"studio_route_not_found"},404);
  };
}

export async function startStudioServer({
  host="127.0.0.1",
  port=8787,
  statePath=null,
  executionBridgeProvider,
  authorizeOperator,
  actions
}={}) {
  const statusReader=statePath
    ? async()=>inspectLaunchRunStateFile(statePath).catch(error=>{
        if (error?.code==="ENOENT") return null;
        throw error;
      })
    : async()=>null;
  const handle=createStudioHttpHandler({statusReader,executionBridgeProvider,authorizeOperator,actions});
  const server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url || "/","http://studio.local").pathname;
      const response=await handle({method:req.method || "GET",pathname,headers:req.headers});
      res.writeHead(response.status,response.headers);
      res.end(response.body);
    } catch (error) {
      const response=json({ok:false,error:"studio_internal_error"},500);
      res.writeHead(response.status,response.headers);
      res.end(response.body);
    }
  });
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(port,host,()=>{server.off("error",reject);resolve();});
  });
  return {server,host,port};
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const port=Number(process.env.PORT || 8787);
  const host=String(process.env.HOST || "0.0.0.0");
  const statePath=process.env.HERCULES_VIDEO_STATE_PATH || null;
  const {server}=await startStudioServer({host,port,statePath});
  const shutdown=()=>server.close(()=>process.exit(0));
  process.once("SIGINT",shutdown);
  process.once("SIGTERM",shutdown);
}
