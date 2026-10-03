const APPS=[
  {id:"hercules",name:"Hercules",summary:"SauceApproved AI software and operations platform",keywords:["ai","software","operations","automation"],visibility:"public",distribution:"controlled",ownedCode:true},
  {id:"sauceapproved-studio",name:"SauceApproved Studio",summary:"Video and creative production workspace",keywords:["video","creative","studio","media"],visibility:"public",distribution:"preview",ownedCode:true},
  {id:"freshtrack-ai",name:"FreshTrack AI",summary:"AI-assisted workflow tracking product",keywords:["workflow","tracking","ai","productivity"],visibility:"public",distribution:"preview",ownedCode:true},
  {id:"sauceapproved-forge",name:"SauceApproved Forge",summary:"Owned build and deployment control plane",keywords:["forge","build","deploy","control"],visibility:"internal",distribution:"owner-only",ownedCode:true},
  {id:"sauceapproved-ops-hub",name:"SauceApproved Ops Hub",summary:"Internal operations control surface",keywords:["ops","operations","control","monitoring"],visibility:"internal",distribution:"owner-only",ownedCode:true},
].map(app=>Object.freeze({...app,keywords:Object.freeze([...app.keywords])}));

export const MARKETPLACE_CATALOG=Object.freeze({
  schema:"sauceapproved.marketplace.catalog",
  version:1,
  owner:"SauceApproved",
  apps:Object.freeze(APPS),
});

function audienceApps(audience){
  if(audience==="owner")return MARKETPLACE_CATALOG.apps;
  if(audience==="public")return MARKETPLACE_CATALOG.apps.filter(app=>app.visibility==="public");
  throw new TypeError("marketplace audience must be public or owner");
}

export function createMarketplaceCatalog({audience="public"}={}){
  return Object.freeze({
    schema:MARKETPLACE_CATALOG.schema,
    version:MARKETPLACE_CATALOG.version,
    owner:MARKETPLACE_CATALOG.owner,
    audience,
    apps:Object.freeze([...audienceApps(audience)]),
  });
}

export function getMarketplaceApp(id,{audience="public"}={}){
  const key=String(id||"").trim().toLowerCase();
  return audienceApps(audience).find(app=>app.id===key)||null;
}

export function findMarketplaceApps(query,{audience="public"}={}){
  const terms=String(query||"").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if(!terms.length)return [];
  return audienceApps(audience)
    .map(app=>{
      const haystack=[app.id,app.name,app.summary,...app.keywords].join(" ").toLowerCase();
      return {app,score:terms.reduce((n,term)=>n+(haystack.includes(term)?1:0),0)};
    })
    .filter(row=>row.score===terms.length)
    .sort((a,b)=>b.score-a.score||a.app.id.localeCompare(b.app.id))
    .map(row=>row.app);
}
