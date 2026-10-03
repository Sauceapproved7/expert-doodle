function freezeList(values){return Object.freeze(values.map(value=>Object.freeze(value)))}

export function createIntegrationsManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.integrations.manifest",
    version:1,
    product:"Hercules Integrations Hub",
    executionPolicy:"inventory-plan-authorize-fail-closed",
    autoConnect:false,
    credentialCollectionAllowed:false,
    autonomousMutation:false,
    providerNeutral:true,
    differentiators:Object.freeze(["Permission Boundary Map","Connection Readiness Ledger"]),
    connectionClasses:freezeList([
      {id:"rendering",label:"Rendering & generation",state:"runtime-verification-required",examples:["owned/self-hosted runner","authorized external model provider"]},
      {id:"commerce",label:"Commerce & entitlement",state:"runtime-verification-required",examples:["Shopify paid-order transport","Studio entitlement bridge"]},
      {id:"data",label:"Data & identity",state:"runtime-verification-required",examples:["Supabase auth/data plane","owned Studio state"]},
      {id:"source",label:"Source & deployment",state:"runtime-verification-required",examples:["GitHub canonical repository","authorized deployment target"]},
      {id:"publishing",label:"Publishing & distribution",state:"runtime-verification-required",examples:["approved social publisher","customer-owned destination"]}
    ]),
    rules:Object.freeze([
      "Never treat a listed integration as connected until current runtime evidence verifies it.",
      "Never collect passwords, cookies, private keys, or 2FA codes through this surface.",
      "Authorization-sensitive connections require an owner-controlled or already-authorized provider path.",
      "A missing integration blocks only the dependent action; it does not authorize a workaround."
    ])
  });
}

export function renderIntegrationsHub(){
  const manifest=createIntegrationsManifest();
  const cards=manifest.connectionClasses.map((item,index)=>`
    <article class="card"><span>${String(index+1).padStart(2,"0")} / ${item.state.toUpperCase()}</span><h2>${item.label}</h2><p>${item.examples.join(" · ")}</p></article>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Integrations Hub</title><style>
:root{font-family:Inter,system-ui,sans-serif;background:#050609;color:#f7f8ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 75% 0,#28285a,#0b0c18 40%,#050609 78%)}main{width:min(1180px,100%);margin:auto;padding:clamp(20px,5vw,58px)}a{color:#bdbdff;text-decoration:none}.hero{min-height:490px;display:grid;align-content:end;padding:clamp(30px,6vw,72px);border:1px solid #45458a;border-radius:34px;background:linear-gradient(150deg,#202048,#090a12 72%)}.eyebrow{font-size:11px;letter-spacing:.24em;color:#a8a8f0}.hero h1{font-size:clamp(56px,9vw,110px);line-height:.84;letter-spacing:-.06em;margin:16px 0 24px}.hero p{max-width:840px;color:#c1c2d5;font-size:clamp(17px,2vw,22px);line-height:1.55}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.card{min-height:250px;padding:28px;border:1px solid #35366c;border-radius:24px;background:#0d0e1b}.card span{font-size:10px;letter-spacing:.16em;color:#9293d7}.card h2{font-size:28px;margin:44px 0 12px}.card p{color:#a6a7ba;line-height:1.6}.rules{margin-top:16px;padding:24px;border:1px solid #35366c;border-radius:22px;background:#0a0b14}.rules li{margin:10px 0;color:#aaaec3;line-height:1.5}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{border-radius:24px;min-height:420px}}
</style></head><body><main><a href="/">Back to SauceApproved Studio</a><section class="hero"><div class="eyebrow">SAUCEAPPROVED / CONNECTION CONTROL PLANE</div><h1>Integrations<br>Hub</h1><p>See what Hercules can connect, what still needs runtime proof, and where owner authorization begins. Connection inventory is not connection permission.</p></section><section class="grid">${cards}</section><section class="rules"><h2>Hercules connection rules</h2><ul>${manifest.rules.map(rule=>"<li>"+rule+"</li>").join("")}</ul></section></main></body></html>`;
}
