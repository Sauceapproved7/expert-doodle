import {createServer} from "node:http";
import {pathToFileURL} from "node:url";
import {readFile} from "node:fs/promises";
import {inspectLaunchRunStateFile} from "./run-status.mjs";
import {buildStudioViewModel,createStudioManifest} from "./studio-contract.mjs";
import {createContentMultiplierManifest} from "../sauceapproved-studio/content-multiplier/core.mjs";
import {createSalesAgentManifest} from "../sauceapproved-studio/ai-sales-agent/core.mjs";
import {createBrandBrainManifest} from "../sauceapproved-studio/brand-brain/core.mjs";
import {createStudiosMarketManifest} from "../sauceapproved-studio/market/core.mjs";
import {createVintageCameraManifest,renderVintageCamera} from "../sauceapproved-studio/vintage-camera/core.mjs";
import {createKidsStudioManifest,renderKidsStudio} from "../sauceapproved-studio/kids/core.mjs";

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
const CAMERA_HTML_HEADERS=Object.freeze({...HTML_HEADERS,
  "content-security-policy":"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"
});
const CAMERA_JS_HEADERS=Object.freeze({
  "content-type":"text/javascript; charset=utf-8",
  "cache-control":"no-store",
  "x-content-type-options":"nosniff"
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

function renderContentMultiplierShell(manifest) {
  const cards=manifest.differentiators.map((name,index)=>`
    <article class="feature">
      <span>0${index+1}</span>
      <h2>${escapeHtml(name)}</h2>
      <p>${escapeHtml({
        "Content DNA":"Keeps vocabulary, tone, offers, audiences, banned phrases and locked facts attached to the brand.",
        "Variation Tree":"Branches hooks, audiences, platforms, lengths and offers without losing parent-child lineage.",
        "Content Opportunity Radar":"Surfaces strong unused source moments and approved brand facts before they get overlooked.",
        "Variant Fatigue Guard":"Stops near-duplicate content from multiplying and pushes the next branch toward a materially different angle."
      }[name] || "Owned SauceApproved content intelligence.")}</p>
    </article>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>SauceApproved Content Multiplier</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050505;color:#f7f7f7}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 18% 0,#2c1b19 0,#0b0b0b 34%,#040404 74%)}
main{width:min(1120px,100%);margin:auto;padding:clamp(18px,4vw,42px)}
a{color:inherit}.back{display:inline-flex;margin-bottom:26px;color:#aaa;text-decoration:none;font-weight:700}
.hero{padding:clamp(24px,5vw,54px);border:1px solid #2a2524;border-radius:32px;background:linear-gradient(145deg,#171313,#0b0b0b);box-shadow:0 28px 100px #0009}
.eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#bf9189}.title{font-size:clamp(42px,9vw,86px);line-height:.92;margin:10px 0 18px;font-weight:950;letter-spacing:-.055em}.title em{font-style:normal;color:#e1b6ae}
.sub{max-width:760px;color:#b5b5b5;font-size:clamp(16px,2vw,20px);line-height:1.6}
.status{margin-top:24px;padding:16px 18px;border:1px solid #5a3c24;border-radius:18px;background:#1d140d;color:#f0c789;font-weight:800}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}.feature{min-height:210px;padding:24px;border-radius:24px;border:1px solid #282323;background:#0c0c0cee}.feature span{font-size:11px;letter-spacing:.18em;color:#8d706b}.feature h2{font-size:24px;margin:38px 0 10px}.feature p{color:#999;line-height:1.55;margin:0}
.footer{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:18px;padding:18px;border:1px solid #222;border-radius:20px;background:#090909;color:#888}.pill{font-size:12px;border:1px solid #333;padding:7px 10px;border-radius:999px;color:#bbb}
@media(max-width:720px){.grid{grid-template-columns:1fr}.hero{border-radius:24px}.feature{min-height:auto}}
</style>
</head>
<body>
<main>
<a class="back" href="/">← SauceApproved Studio</a>
<section class="hero">
<div class="eyebrow">SauceApproved Studios / Hercules-owned module</div>
<h1 class="title">Content <em>Multiplier</em></h1>
<p class="sub">Turn one approved source into a governed content system. Brand truth stays locked, variation stays traceable, and repetitive branches are caught before they waste output.</p>
<div class="status">Generation provider not connected — generation stays fail-closed until an authorized provider is configured.</div>
</section>
<section class="grid">${cards}</section>
<div class="footer">
<span>Execution policy: <b>${escapeHtml(manifest.executionPolicy)}</b></span>
<span class="pill">Provider required for generation</span>
</div>
</main>
</body>
</html>`;
}

function renderSalesAgentShell(manifest) {
  const descriptions={
    "Objection Intelligence Map":"Groups explicit buyer friction into useful objection evidence without inferring sensitive traits.",
    "Adaptive Pitch Memory":"Keeps only explicitly stated sales context for the active session so the conversation adapts without hidden profiling.",
    "Confidence-to-Handoff Governor":"Uses approved-knowledge support, locked-fact coverage, ambiguity and action risk to decide whether to answer, clarify or hand off.",
    "Objection-to-Asset Bridge":"Turns recurring objection evidence into review-required Content Multiplier briefs instead of silently changing brand truth."
  };
  const cards=manifest.differentiators.map((name,index)=>`
    <article class="feature">
      <span>0${index+1}</span>
      <h2>${escapeHtml(name)}</h2>
      <p>${escapeHtml(descriptions[name] || "Owned SauceApproved sales intelligence.")}</p>
    </article>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>SauceApproved AI Sales Agent</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050505;color:#f7f7f7}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 80% 0,#17221c 0,#0a0d0b 36%,#040404 74%)}
main{width:min(1120px,100%);margin:auto;padding:clamp(18px,4vw,42px)}
a{color:inherit}.back{display:inline-flex;margin-bottom:26px;color:#aaa;text-decoration:none;font-weight:700}
.hero{padding:clamp(24px,5vw,54px);border:1px solid #25312a;border-radius:32px;background:linear-gradient(145deg,#111713,#0a0b0a);box-shadow:0 28px 100px #0009}
.eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#86b698}.title{font-size:clamp(42px,9vw,86px);line-height:.92;margin:10px 0 18px;font-weight:950;letter-spacing:-.055em}.title em{font-style:normal;color:#aee0bd}
.sub{max-width:780px;color:#b5b5b5;font-size:clamp(16px,2vw,20px);line-height:1.6}
.status{margin-top:24px;padding:16px 18px;border:1px solid #574224;border-radius:18px;background:#1c160d;color:#f0ce8e;font-weight:800}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}.feature{min-height:220px;padding:24px;border-radius:24px;border:1px solid #202b24;background:#0b0e0cee}.feature span{font-size:11px;letter-spacing:.18em;color:#6f967c}.feature h2{font-size:24px;margin:38px 0 10px}.feature p{color:#999;line-height:1.55;margin:0}
.footer{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:18px;padding:18px;border:1px solid #222;border-radius:20px;background:#090909;color:#888}.pill{font-size:12px;border:1px solid #333;padding:7px 10px;border-radius:999px;color:#bbb}
@media(max-width:720px){.grid{grid-template-columns:1fr}.hero{border-radius:24px}.feature{min-height:auto}}
</style>
</head>
<body>
<main>
<a class="back" href="/">← SauceApproved Studio</a>
<section class="hero">
<div class="eyebrow">SauceApproved Studios / Hercules-owned module</div>
<h1 class="title">AI Sales <em>Agent</em></h1>
<p class="sub">Grounded sales intelligence built around approved products, explicit customer context, consent, auditable handoff decisions and controlled business actions.</p>
<div class="status">Action adapter not connected — business actions stay fail-closed until an authorized adapter is configured.</div>
</section>
<section class="grid">${cards}</section>
<div class="footer">
<span>Execution policy: <b>${escapeHtml(manifest.executionPolicy)}</b></span>
<span class="pill">Sensitive profiling disabled</span>
</div>
</main>
</body>
</html>`;
}

function renderBrandBrainShell(manifest) {
  const descriptions={
    "Brand Constitution":"Turns brand rules into versioned, enforceable policy with precedence, inherited rules, explicit overrides and conflict detection.",
    "Cross-Channel Consistency Simulator":"Finds contradictions in price, CTA, disclosure, promise, audience and timing before content ships.",
    "Rule Blast Radius Preview":"Shows which assets, agents and campaigns a proposed rule change would affect before approval.",
    "Brand Drift Time Machine":"Compares two Constitution versions and judges the same asset against both rule sets."
  };
  const cards=manifest.differentiators.map((name,index)=>`
    <article class="feature">
      <span>0${index+1}</span>
      <h2>${escapeHtml(name)}</h2>
      <p>${escapeHtml(descriptions[name] || "Owned SauceApproved brand governance.")}</p>
    </article>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>SauceApproved Brand Brain</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050505;color:#f7f7f7}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -10%,#262036 0,#0d0b11 36%,#040404 75%)}
main{width:min(1120px,100%);margin:auto;padding:clamp(18px,4vw,42px)}
a{color:inherit}.back{display:inline-flex;margin-bottom:26px;color:#aaa;text-decoration:none;font-weight:700}
.hero{padding:clamp(24px,5vw,54px);border:1px solid #302a3c;border-radius:32px;background:linear-gradient(145deg,#17131e,#0a090c);box-shadow:0 28px 100px #0009}
.eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#ae94cf}.title{font-size:clamp(42px,9vw,86px);line-height:.92;margin:10px 0 18px;font-weight:950;letter-spacing:-.055em}.title em{font-style:normal;color:#ceb3ee}
.sub{max-width:800px;color:#b5b5b5;font-size:clamp(16px,2vw,20px);line-height:1.6}
.status{margin-top:24px;padding:16px 18px;border:1px solid #574224;border-radius:18px;background:#1c160d;color:#f0ce8e;font-weight:800}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}.feature{min-height:220px;padding:24px;border-radius:24px;border:1px solid #2a2432;background:#0d0b10ee}.feature span{font-size:11px;letter-spacing:.18em;color:#9078ab}.feature h2{font-size:24px;margin:38px 0 10px}.feature p{color:#999;line-height:1.55;margin:0}
.footer{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:18px;padding:18px;border:1px solid #222;border-radius:20px;background:#090909;color:#888}.pill{font-size:12px;border:1px solid #333;padding:7px 10px;border-radius:999px;color:#bbb}
@media(max-width:720px){.grid{grid-template-columns:1fr}.hero{border-radius:24px}.feature{min-height:auto}}
</style>
</head>
<body>
<main>
<a class="back" href="/">← SauceApproved Studio</a>
<section class="hero">
<div class="eyebrow">SauceApproved Studios / Hercules-owned governance</div>
<h1 class="title">Brand <em>Brain</em></h1>
<p class="sub">A governed source of truth for approved facts, provenance, Brand Constitution rules, multi-brand inheritance, cross-channel consistency and downstream impact analysis.</p>
<div class="status">Changes require review — Brand Brain does not silently auto-learn or rewrite approved brand truth.</div>
</section>
<section class="grid">${cards}</section>
<div class="footer">
<span>Change policy: <b>${escapeHtml(manifest.executionPolicy)}</b></span>
<span class="pill">Silent auto-learning disabled</span>
</div>
</main>
</body>
</html>`;
}

function renderStudiosMarketShell(manifest) {
  const cards=manifest.products.map((item,index)=>`
    <article class="offer">
      <div class="count">0${index+1}</div>
      <h2>${escapeHtml(item.name)}</h2>
      <p>${escapeHtml(item.summary)}</p>
      <div class="actions">
        <a class="secondary" href="${escapeHtml(item.route)}">View product</a>
        <a class="primary" href="${escapeHtml(item.ctaUrl)}" rel="noreferrer">Request founding access</a>
      </div>
    </article>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>SauceApproved Studios Market</title>
<meta name="description" content="Explore SauceApproved Studios products and request controlled founding access.">
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050505;color:#f6f6f6}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% -10%,#2d201b 0,#10100f 32%,#040404 72%)}
main{width:min(1180px,100%);margin:auto;padding:clamp(18px,4vw,46px)}
a{color:inherit;text-decoration:none}.back{display:inline-flex;margin-bottom:24px;color:#aaa;font-weight:750}
.hero{border:1px solid #332b27;border-radius:32px;padding:clamp(26px,5vw,58px);background:linear-gradient(145deg,#1b1512,#0b0b0b);box-shadow:0 28px 100px #0009}
.eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#c6927d}
h1{font-size:clamp(46px,9vw,92px);line-height:.9;letter-spacing:-.06em;margin:12px 0 20px;font-weight:950}
h1 em{font-style:normal;color:#e8b7a4}.lead{max-width:820px;color:#bababa;font-size:clamp(17px,2vw,21px);line-height:1.6}
.state{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:26px}.state div{border:1px solid #2d2927;border-radius:16px;padding:14px;background:#0d0c0b}.state span{display:block;color:#777;font-size:10px;letter-spacing:.14em;text-transform:uppercase}.state strong{display:block;margin-top:6px}.open{color:#9ee2af}.locked{color:#f0c787}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}.offer{min-height:300px;border:1px solid #282422;border-radius:24px;padding:26px;background:#0b0b0bea;display:flex;flex-direction:column}.count{color:#876e63;font-size:11px;letter-spacing:.18em}.offer h2{font-size:28px;margin:42px 0 12px}.offer p{color:#999;line-height:1.6;margin:0 0 24px}.actions{margin-top:auto;display:flex;gap:10px;flex-wrap:wrap}.actions a{padding:12px 14px;border-radius:13px;font-weight:850;font-size:13px}.primary{background:#f2f2f2;color:#070707}.secondary{border:1px solid #34302e;color:#c8c8c8}
.notice{margin-top:18px;border:1px solid #574224;background:#1b140d;color:#eccb91;padding:18px;border-radius:18px;line-height:1.55}
.foot{margin-top:18px;color:#777;font-size:13px;line-height:1.6}
@media(max-width:760px){.grid,.state{grid-template-columns:1fr}.hero{border-radius:24px}.offer{min-height:auto}}
</style>
</head>
<body>
<main>
<a class="back" href="/">← SauceApproved Studio</a>
<section class="hero">
<div class="eyebrow">SauceApproved Studios / Market</div>
<h1>Built to work. <em>Built to sell.</em></h1>
<p class="lead">Three owned Hercules-grade products are open for controlled founding access. Explore each product, choose the workflow that fits your business, and submit a founding-access request through the protected Hercules intake.</p>
<div class="state">
  <div><span>Discovery</span><strong class="open">Public</strong></div>
  <div><span>Founding applications</span><strong class="open">Open</strong></div>
  <div><span>Paid checkout</span><strong class="locked">Locked pending verification</strong></div>
</div>
</section>
<section class="grid">${cards}</section>
<div class="notice"><b>Paid checkout remains locked.</b> Pricing approval, Terms, Privacy, and the payout/checkout/refund path must be verified before SauceApproved accepts a public paid software order. Founding-access requests are open now; they do not create a charge.</div>
<p class="foot">Current product surfaces show verified owned capabilities and clearly disclose unavailable provider integrations. No testimonial, ROI guarantee, uptime claim, or external integration is represented as live without evidence.</p>
</main>
</body>
</html>`;
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
${manifest.surfaces.map(surface=>surface.id==="content-multiplier" ? `<a class="surface" href="/content-multiplier">${escapeHtml(surface.label)}</a>` : surface.id==="ai-sales-agent" ? `<a class="surface" href="/ai-sales-agent">${escapeHtml(surface.label)}</a>` : surface.id==="brand-brain" ? `<a class="surface" href="/brand-brain">${escapeHtml(surface.label)}</a>` : surface.id==="market" ? `<a class="surface" href="/market">${escapeHtml(surface.label)}</a>` : surface.id==="vintage-camera" ? `<a class="surface" href="/vintage-camera">${escapeHtml(surface.label)}</a>` : surface.id==="kids" ? `<a class="surface" href="/kids">${escapeHtml(surface.label)}</a>` : `<div class="surface">${escapeHtml(surface.label)}</div>`).join("")}
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

    if (normalizedMethod==="GET" && normalizedPath==="/api/studio/content-multiplier/manifest") {
      return json(createContentMultiplierManifest());
    }

    if (normalizedMethod==="GET" && normalizedPath==="/content-multiplier") {
      return {status:200,headers:HTML_HEADERS,body:renderContentMultiplierShell(createContentMultiplierManifest())};
    }

    if (normalizedMethod==="GET" && normalizedPath==="/api/studio/ai-sales-agent/manifest") {
      return json(createSalesAgentManifest());
    }

    if (normalizedMethod==="GET" && normalizedPath==="/ai-sales-agent") {
      return {status:200,headers:HTML_HEADERS,body:renderSalesAgentShell(createSalesAgentManifest())};
    }

    if (normalizedMethod==="GET" && normalizedPath==="/api/studio/brand-brain/manifest") {
      return json(createBrandBrainManifest());
    }

    if (normalizedMethod==="GET" && normalizedPath==="/brand-brain") {
      return {status:200,headers:HTML_HEADERS,body:renderBrandBrainShell(createBrandBrainManifest())};
    }

    if (normalizedMethod==="GET" && normalizedPath==="/api/studio/market/manifest") {
      return json(createStudiosMarketManifest());
    }

    if (normalizedMethod==="GET" && normalizedPath==="/market") {
      return {status:200,headers:HTML_HEADERS,body:renderStudiosMarketShell(createStudiosMarketManifest())};
    }

    if (normalizedMethod==="GET" && normalizedPath==="/vintage-camera") {
      return {status:200,headers:CAMERA_HTML_HEADERS,body:renderVintageCamera()};
    }

    if (normalizedMethod==="GET" && normalizedPath==="/assets/vintage-camera.js") {
      const body=await readFile(new URL("../sauceapproved-studio/vintage-camera/client.js",import.meta.url),"utf8");
      return {status:200,headers:CAMERA_JS_HEADERS,body};
    }

    if (normalizedMethod==="GET" && normalizedPath==="/assets/capture-quality.mjs") {
      const body=await readFile(new URL("../sauceapproved-studio/vintage-camera/capture-quality.mjs",import.meta.url),"utf8");
      return {status:200,headers:CAMERA_JS_HEADERS,body};
    }

    if (normalizedMethod==="GET" && normalizedPath==="/api/studio/vintage-camera/manifest") {
      return json(createVintageCameraManifest());
    }

    if (normalizedMethod==="GET" && normalizedPath==="/kids") {
      return {status:200,headers:CAMERA_HTML_HEADERS,body:renderKidsStudio()};
    }

    if (normalizedMethod==="GET" && normalizedPath==="/assets/kids-studio.js") {
      const body=await readFile(new URL("../sauceapproved-studio/kids/client.js",import.meta.url),"utf8");
      return {status:200,headers:CAMERA_JS_HEADERS,body};
    }

    if (normalizedMethod==="GET" && normalizedPath==="/api/studio/kids/manifest") {
      return json(createKidsStudioManifest());
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
