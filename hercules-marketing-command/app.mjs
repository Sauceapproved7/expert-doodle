import {evaluateCampaign,buildContentPack,buildTrackedUrl,calculateEconomics,rankOpportunities} from './engine.mjs';

const byId=id=>document.getElementById(id);
const element=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=String(text);
  return node;
};
const dollars=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let draft=null;
const research=[];

function showStatus(report){
  const area=byId('campaign-result');
  area.replaceChildren();
  area.className='result '+(report.reviewReady?'good':'block');
  area.append(element('strong','',report.reviewReady?'BRIEF READY FOR HUMAN REVIEW — PUBLICATION LOCKED':'CAMPAIGN DRAFT BLOCKED'));
  if(report.blockers.length){
    area.append(element('p','', 'Resolve: '+report.blockers.join(' · ').replaceAll('_',' ')));
  }else{
    area.append(element('p','','All required fields are present. Proof has NOT been independently checked. Nothing was published, scheduled, sent or purchased.'));
  }
  if(report.claimFlags.length){
    area.append(element('p','','Risk flags: '+report.claimFlags.map(x=>x.reason).join(' ')));
  }
}

function readCampaign(form){
  const data=new FormData(form);
  return {
    division:String(data.get('division')||''),channel:String(data.get('channel')||''),
    title:String(data.get('title')||''),audience:String(data.get('audience')||''),
    promise:String(data.get('promise')||''),proof:String(data.get('proof')||''),
    cta:String(data.get('cta')||''),destination:String(data.get('destination')||''),
    tracking:String(data.get('tracking')||''),recipientConsent:data.get('recipientConsent')==='on'
  };
}

function renderPlan(input,pack,link,report){
  const grid=byId('pack');
  grid.replaceChildren();
  for(const item of pack){
    const card=element('article','pack-card');
    card.append(element('small','',item.ratio+' / DRAFT ONLY'),element('strong','',item.name),element('p','',item.beat),element('p','',item.promise),element('p','', 'CTA: '+item.cta));
    grid.append(card);
  }
  byId('tracked-url').textContent=link;
  byId('tracked-link').hidden=false;
  byId('export').disabled=false;
  draft={schema:'sauceapproved.marketing-command.draft.v1',createdAt:new Date().toISOString(),
    campaign:input,formats:pack,attributedDestination:link,review:report,
    independentlyVerified:false,publishAuthorized:false,paidAdvertisingAuthorized:false,
    affiliateOrOutreachAuthorized:false};
}

byId('campaign-form').addEventListener('submit',event=>{
  event.preventDefault();
  draft=null;
  byId('export').disabled=true;
  byId('pack').replaceChildren();
  byId('tracked-link').hidden=true;
  const input=readCampaign(event.currentTarget);
  const report=evaluateCampaign(input);
  showStatus(report);
  if(!report.reviewReady)return;
  try{
    const pack=buildContentPack(input);
    const source=input.channel==='meta_ads'?'meta':input.channel==='google_ads'?'google':input.channel;
    const medium=['meta_ads','google_ads'].includes(input.channel)?'paid':'organic';
    const link=buildTrackedUrl(input.destination,{source,medium,campaign:input.tracking||input.title});
    renderPlan(input,pack,link,report);
  }catch{
    const target=byId('campaign-result');
    target.className='result block';
    target.textContent='Cannot produce a safe tracked campaign plan. Check the destination and tracking fields.';
  }
});

byId('copy-url').addEventListener('click',async()=>{
  const button=byId('copy-url');
  const url=byId('tracked-url').textContent;
  if(!url)return;
  try{
    if(!navigator.clipboard?.writeText)throw Error('clipboard_unavailable');
    await navigator.clipboard.writeText(url);
    button.textContent='COPIED';
  }catch{
    button.textContent='SELECT THE LINK TO COPY';
    const selection=window.getSelection();
    const range=document.createRange();
    range.selectNodeContents(byId('tracked-url'));
    selection.removeAllRanges();
    selection.addRange(range);
  }
});

byId('export').addEventListener('click',()=>{
  if(!draft)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download='sauceapproved-marketing-draft.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revocation on later user action, so the browser has time to resolve the download.
  byId('export').addEventListener('click',()=>URL.revokeObjectURL(url),{once:true});
});

function refreshEconomics(){
  try{
    const input={};
    for(const id of ['price','unitCost','fees','fulfillmentCost','cac'])input[id]=byId(id).value;
    const result=calculateEconomics(input);
    byId('break-even').textContent=dollars(result.breakEvenCac);
    byId('net-margin').textContent=dollars(result.netContribution);
    byId('net-margin').classList.toggle('negative',result.netContribution<=0);
    byId('econ-status').textContent=result.netContribution>0?
      'Positive modeled contribution. Validate real production, shipping, fees, refunds and advertising cost before spending.':
      'This scenario does not yield positive per-order contribution. Do not scale paid acquisition on these assumptions.';
  }catch{
    byId('break-even').textContent='INVALID';
    byId('net-margin').textContent='INVALID';
    byId('econ-status').textContent='Enter valid non-negative finite cost amounts.';
  }
}
for(const id of ['price','unitCost','fees','fulfillmentCost','cac'])byId(id).addEventListener('input',refreshEconomics);
refreshEconomics();

byId('opportunity-form').addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const data=new FormData(form);
  const item={
    title:String(data.get('title')||''),sourceUrl:String(data.get('sourceUrl')||''),
    relevance:Number(data.get('relevance')),evidenceStrength:Number(data.get('evidenceStrength')),
    effort:Number(data.get('effort'))
  };
  try{
    const validated=rankOpportunities([item]);
    if(validated.length!==1)throw Error('invalid_signal');
    if(research.length>=100)throw Error('capacity_limit');
    research.push(item);
    const ranking=rankOpportunities(research);
    byId('signal-count').textContent=ranking.length+' unverified hypotheses';
    const list=byId('signals');
    list.replaceChildren();
    for(const signal of ranking){
      const row=element('article','signal');
      const details=element('div');
      const score=element('span','signal-score',String(signal.score));
      const link=element('a','', 'PUBLIC SOURCE ↗');
      link.href=signal.sourceUrl;
      link.target='_blank';
      link.rel='noopener noreferrer';
      details.append(element('strong','',signal.title),link,element('p','mute','Not measured demand; independently validate source context.'));
      row.append(details,score);
      list.append(row);
    }
    form.reset();
  }catch{
    byId('signal-count').textContent='Rejected: complete a valid public HTTPS source and 1–5 scores';
  }
});
