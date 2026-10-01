const clean=s=>String(s??"").trim();
export function productIntelligence(p={}){const title=clean(p.title);return {product:title,angles:[`${title}: outcome`,`${title}: differentiation`],objections:["price","trust","fit"],status:title?"ready":"needs_product"}}
export function creativeLab({product="",angle=""}={}){return {hooks:[`Why ${product} is different`,`${angle}: see the proof`],formats:["ugc","static","short-video"],variants:3}}
export function offerArchitect({price=0,cost=0}={}){const floor=Number(cost)||0,p=Number(price)||0;return {marginFloor:floor,basePrice:p,discountCap:p>0?Math.max(0,(p-floor)/p):0,approvalRequired:true}}
export function landingPageKiller({title="",description="",cta=""}={}){const issues=[];if(clean(title).length<8)issues.push("weak_title");if(clean(description).length<80)issues.push("thin_description");if(!clean(cta))issues.push("missing_cta");return {issues,score:Math.max(0,100-issues.length*25)}}
export function retentionEngine(){return {flows:["welcome","browse-abandonment","cart-abandonment","post-purchase","cross-sell","replenishment","win-back","vip"],sendMode:"approval-gated"}}
export function creativePerformanceBrain(rows=[]){return [...rows].sort((a,b)=>(Number(b.contribution)||0)-(Number(a.contribution)||0))}
export function blackbox(events=[]){return {events:[...events],insights:events.filter(x=>x?.type==="insight"),failClosed:true}}
export function shadowRadar(pages=[]){return {scope:"public-pages-only",bypassAccessControls:false,snapshots:pages.map(x=>({url:x.url,price:x.price??null,offer:x.offer??null}))}}
export function creativeDNA(items=[]){return items.map((x,i)=>({id:x.id??`dna-${i+1}`,hook:x.hook??null,angle:x.angle??null,format:x.format??null,result:x.result??null}))}
export function customerXRay(feedback=[]){return {authorizedOnly:true,insights:feedback.filter(x=>x?.authorized===true).map(x=>({language:clean(x.text),source:x.source??"first-party"}))}}
