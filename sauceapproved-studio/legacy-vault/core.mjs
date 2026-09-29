const DIFFERENTIATORS=Object.freeze(["Consent Horizon","Memory Provenance Chain","Generational Story Weave"]);

function clean(value){return String(value??"").trim();}
function esc(value){return clean(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}

export function createLegacyVaultManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.legacy-vault.manifest",
    version:1,
    product:"Hercules Legacy Vault",
    category:"documentary-legacy-storytelling",
    executionPolicy:"consent-and-provenance-gated",
    autoPublish:false,
    differentiators:DIFFERENTIATORS,
    competitionGapFeatures:Object.freeze(["Consent Horizon","Memory Provenance Chain"]),
    reviewGates:Object.freeze(["consent","privacy","provenance","editorial-review"])
  });
}

export function buildLegacyFilmPlan(input={}){
  const title=clean(input.title), subject=clean(input.subject);
  const sources=Array.isArray(input.approvedSources)?input.approvedSources:[];
  const chaptersInput=Array.isArray(input.chapters)?input.chapters.map(clean).filter(Boolean):[];
  if(!title||!subject||!sources.length||!chaptersInput.length) throw new Error("legacy_brief_incomplete");
  if(sources.some(source=>source?.approved!==true)) throw new Error("unapproved_source_material");
  const sourceLedger=Object.freeze(sources.map((source,index)=>Object.freeze({
    sourceId:clean(source.id)||"source-"+(index+1),
    type:clean(source.type)||"unknown",
    label:clean(source.label)||"Source "+(index+1),
    approved:true,
    provenanceStatus:"source-identified",
    consentHorizon:Object.freeze({
      status:"review-required",
      allowedUses:Object.freeze(["private-edit","family-review"]),
      publicUse:false,
      expiration:null
    })
  })));
  const chapters=Object.freeze(chaptersInput.map((name,index)=>{
    const count=Math.max(1,Math.ceil(sourceLedger.length/chaptersInput.length));
    const start=index*count;
    const slice=sourceLedger.slice(start,start+count);
    const assigned=slice.length?slice:[sourceLedger[index%sourceLedger.length]];
    return Object.freeze({
      order:index+1,
      chapterId:"chapter-"+(index+1),
      name,
      sourceIds:Object.freeze(assigned.map(item=>item.sourceId)),
      editorialIntent:index===0?"origin and context":index===chaptersInput.length-1?"meaning and handoff":"change, tension, and connection"
    });
  }));
  return Object.freeze({
    schema:"sauceapproved.studio.legacy-vault.film-plan",
    version:1,
    title,subject,
    sourceLedger,
    chapters,
    memoryProvenanceChain:Object.freeze(chapters.flatMap(chapter=>chapter.sourceIds.map(sourceId=>Object.freeze({sourceId,chapterId:chapter.chapterId,transform:"editorial-plan-only"})))),
    reviewGates:Object.freeze(["consent","privacy","provenance","editorial-review"]),
    publishReady:false,
    autoPublish:false
  });
}

export function renderLegacyVault(){
  const manifest=createLegacyVaultManifest();
  const cards=[
    ["CONSENT HORIZON","Every photo, clip, and voice note carries its allowed uses, review state, public/private boundary, and future restriction instead of one blanket permission."],
    ["MEMORY PROVENANCE CHAIN","Every chapter can trace back to the original approved source and record what editorial transformation was planned, so generated storytelling does not erase where the memory came from."],
    ["GENERATIONAL STORY WEAVE","Builds chapters across people, eras, and source types while preserving whose memory is whose and where perspectives disagree."]
  ];
  const cardHtml=cards.map((c,i)=>'<article class="card"><span>0'+(i+1)+'</span><h2>'+esc(c[0])+'</h2><p>'+esc(c[1])+'</p></article>').join("");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hercules Legacy Vault</title><style>'+
  ':root{font-family:Georgia,"Times New Roman",serif;background:#090704;color:#f7f0e2}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 18% 0,#3c2918 0,#181109 34%,#090704 75%)}main{width:min(1120px,100%);margin:auto;padding:clamp(18px,4vw,46px)}a{font-family:Inter,system-ui,sans-serif;color:#d9b87c;text-decoration:none}.hero{min-height:470px;display:grid;align-content:end;padding:clamp(28px,6vw,72px);border:1px solid #4a3926;border-radius:34px;background:linear-gradient(145deg,#1d140b,#0e0a06);box-shadow:0 30px 110px #000b}.eyebrow{font-family:Inter,system-ui,sans-serif;font-size:11px;letter-spacing:.23em;color:#cfad70}.hero h1{font-size:clamp(52px,9vw,100px);font-weight:700;line-height:.9;letter-spacing:-.055em;margin:12px 0 20px}.hero p{max-width:790px;color:#c9bba3;font-size:clamp(18px,2.2vw,23px);line-height:1.58}.badge{font-family:Inter,system-ui,sans-serif;display:inline-flex;margin-top:18px;border:1px solid #67543a;border-radius:999px;padding:9px 12px;color:#e4c993;font-size:12px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.card{min-height:270px;padding:25px;border:1px solid #3a2d20;border-radius:24px;background:#130e09}.card span{font-family:Inter,system-ui,sans-serif;font-size:11px;letter-spacing:.16em;color:#9e8050}.card h2{font-size:25px;margin:44px 0 12px}.card p{color:#b8a990;line-height:1.65}.foot{font-family:Inter,system-ui,sans-serif;margin-top:18px;padding:18px;border:1px solid #3a2d20;border-radius:18px;color:#998b76;background:#100b07}@media(max-width:820px){.grid{grid-template-columns:1fr}.hero{min-height:420px;border-radius:24px}}'+
  '</style></head><body><main><a href="/">Back to SauceApproved Studio</a><section class="hero"><div class="eyebrow">SAUCEAPPROVED / LEGACY FILM SYSTEM</div><h1>Hercules<br>Legacy Vault</h1><p>Turn approved photos, clips, voice notes, and family milestones into a documentary structure without losing consent, privacy, or source truth. The story gets stronger without the evidence getting weaker.</p><div class="badge">No automatic publishing - consent and provenance gates stay active.</div></section><section class="grid">'+cardHtml+'</section><div class="foot">Execution policy: <b>'+esc(manifest.executionPolicy)+'</b> - Original source ownership and permissions remain attached to every planned use.</div></main></body></html>';
}
