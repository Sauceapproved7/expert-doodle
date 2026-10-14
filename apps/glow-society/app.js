(() => {
'use strict';

// Fictional demo data. No orders, real providers, or public accounts are created.
const DEMO_PHOTO='https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=82';
const ROOT='glow-society-v1';
const MODEL_FACE='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MODEL_HAND='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const WASM='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const ESM='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';

const ITEMS=[];
function seed(region, rows) {
  for (let i=0;i<rows.length;i++) {
    const [name,color,tags,desc]=rows[i];
    ITEMS.push({id:region+'-'+i,region,category:['lips','cheeks','eyes'].includes(region)?'makeup':region==='hair'?'hair':'nails',name,color,tags,desc,sku:'CONCEPT-'+(ITEMS.length+1)});
  }
}
seed('lips',[
  ['Oxblood Velvet','#652437',['deep','cool','neutral'],'Rich statement lip · velvet matte'],
  ['Chocolate Muse','#653d30',['deep','warm','neutral'],'Cocoa nude · satin'],
  ['Black Cherry','#431e37',['deep','cool'],'Deep berry · lacquer finish'],
  ['Cinnamon Kiss','#aa594c',['deep','tan','warm'],'Warm russet · satin'],
  ['Plum Royale','#763554',['deep','tan','cool'],'Wine-plum · soft matte'],
  ['Mocha Gloss','#8a5743',['deep','tan','neutral'],'Everyday brown · gloss'],
  ['Ruby After Dark','#ac213e',['deep','tan','medium','cool'],'Blue-red · luminous'],
  ['Caramel Nude','#ba8265',['tan','medium','warm'],'Golden nude · cream'],
  ['Spiced Terracotta','#b45e48',['deep','tan','warm'],'Copper clay · satin'],
  ['Berry Crush','#a04e79',['tan','medium','cool'],'Berry sheen · gloss'],
  ['Rosewood','#9e6462',['medium','light','neutral'],'Dusty rose · satin'],
  ['Soft Petal','#d995a1',['light','cool'],'Fresh blush pink · gloss']
]);
seed('cheeks',[
  ['Mahogany Glow','#804b44',['deep','warm'],'Rich warm blush'],
  ['Mulberry Flush','#813f67',['deep','cool'],'Cool berry blush'],
  ['Copper Sunset','#b56c43',['deep','tan','warm'],'Radiant copper highlight'],
  ['Deep Rose','#95485b',['deep','tan','neutral'],'Rose-red cream blush'],
  ['Golden Hour','#ba8458',['tan','medium','warm'],'Golden shimmer'],
  ['Warm Coral','#df8973',['tan','medium','warm'],'Peach coral blush'],
  ['Pink Cloud','#df9eaa',['light','medium','cool'],'Soft powder blush']
]);
seed('eyes',[
  ['Bronzed Goddess','#a66f42',['deep','tan','warm'],'Copper-bronze shimmer'],
  ['Chocolate Smoke','#51372d',['deep','tan','neutral'],'Soft brown smoky eye'],
  ['Royal Amethyst','#74507c',['deep','cool'],'Plum jewel shadow'],
  ['Gold Foil','#d6ab60',['deep','tan','medium','warm'],'Golden highlight'],
  ['Olive Velvet','#777950',['deep','tan','olive'],'Olive satin'],
  ['Champagne Kiss','#dcc4a5',['light','medium','neutral'],'Soft champagne']
]);
seed('hair',[
  ['4C Crown Coils','#2d231e',['4c','coils','natural'],'Defined natural 4C texture'],
  ['Knotless Goddess Braids','#392b26',['braids','protective'],'Long knotless braid inspiration'],
  ['Honey-Tipped Locs','#866044',['locs','protective'],'Locs with golden tips'],
  ['Silk Press Espresso','#30231d',['silk press','4c'],'Sleek silk press concept'],
  ['Chunky Flat Twists','#36241f',['twists','protective'],'Protective flat twists'],
  ['Burgundy Butterfly Locs','#632539',['locs','protective'],'Burgundy loc-inspired style'],
  ['Bouncy 3B Curls','#593a2d',['3b','curls'],'Voluminous ringlets'],
  ['Copper 4A Wash & Go','#9c4c2c',['4a','coils'],'Copper coils concept'],
  ['Fulani Braids','#2c1e19',['braids','protective'],'Intricate braid pattern'],
  ['Jet Black Sew-In','#211b21',['sew-in','protective'],'Classic soft-layer sew-in'],
  ['Chocolate Pixie Wig','#513126',['wigs','protective'],'Short wig inspiration'],
  ['Natural Twist-Out','#40291e',['4b','twists'],'Soft natural 4B twist-out']
]);
seed('nails',[
  ['Espresso French','#60372c',['short','french'],'Deep coffee tips'],
  ['Rose Gold Chrome','#b57f84',['chrome','almond'],'Metallic rosy shine'],
  ['Burgundy Coffin','#722b45',['coffin','gloss'],'Deep wine manicure'],
  ['Milk Chocolate','#8a5f4a',['short','square'],'Neutral brown gel'],
  ['Emerald Envy','#285c4e',['almond','gloss'],'Emerald gemstone shade'],
  ['Cocoa & Gold','#8d5e39',['gold','coffin'],'Warm gold detail'],
  ['Plum Shimmer','#724679',['almond','shimmer'],'Purple reflective gel'],
  ['Blush Aura','#cb8c9f',['oval','short'],'Soft pink ombre'],
  ['Caramel Glaze','#a96d42',['almond','gloss'],'Warm polished caramel'],
  ['Midnight Onyx','#302a35',['stiletto','gloss'],'Glossy dark manicure']
]);

const ARTISTS=[
  {id:'amara',name:'Amara Okafor',role:'Deep-skin makeup artist',city:'London / Lagos',specialty:'makeup',bio:'Rich-skin bridal beauty and editorial artistry.',tags:['Deep complexions','Bridal','Editorial'],color:'#713f55'},
  {id:'sade',name:'Sade Mensah',role:'Makeup educator',city:'Brooklyn, NY',specialty:'makeup',bio:'Color theory for red, golden and olive undertones.',tags:['Shade matching','Tutorials','Undertones'],color:'#795443'},
  {id:'nia',name:'Nia Brooks',role:'Protective-style specialist',city:'Atlanta, GA',specialty:'hair',bio:'Knotless braids, loc maintenance and scalp-first styling.',tags:['Braids','Locs','Healthy edges'],color:'#5a3a35'},
  {id:'imani',name:'Imani Walker',role:'Natural hair stylist',city:'Los Angeles, CA',specialty:'hair',bio:'Helping type 3A–4C curls thrive in every season.',tags:['4C care','Natural hair','Twist-outs'],color:'#925b55'},
  {id:'zuri',name:'Zuri James',role:'Nail artist',city:'New York, NY',specialty:'nails',bio:'Chrome, luxe French tips and nail art that pops on melanin.',tags:['Nails','Chrome','Gel'],color:'#a16d83'},
  {id:'ayana',name:'Ayana Cole',role:'Wig and extension artist',city:'Queens, NY',specialty:'hair',bio:'Confidence-first installs, sew-ins and natural-looking wigs.',tags:['Wigs','Sew-ins','Protective'],color:'#825b42'},
  {id:'janelle',name:'Janelle Hayes',role:'Loc artist',city:'Philadelphia, PA',specialty:'hair',bio:'Care-led loc journeys, from starter locs to creative styling.',tags:['Locs','Maintenance','Color'],color:'#6b516d'},
  {id:'maya',name:'Maya Rodriguez',role:'Nail designer',city:'Miami, FL',specialty:'nails',bio:'Tiny art and playful finishes for every skin tone.',tags:['Micro art','Soft gel','Almond'],color:'#a66870'}
];
const POSTS=[
  {id:'seed-1',name:'Amara O.',avatar:'AO',color:'#713f55',text:'That chocolate nude lip with a copper highlight on deep skin? Forever a favorite. Tip: always test in natural daylight.',tags:['Deep-skin beauty','Lip combo'],likes:229,comments:[]},
  {id:'seed-2',name:'Nia B.',avatar:'NB',color:'#5a3a35',text:'Protective style reminder: beautiful braids should NEVER feel painfully tight. Your edges matter.',tags:['Braids','Hair health'],likes:304,comments:[{by:'Imani',text:'Scalp comfort first, always.'}]},
  {id:'seed-3',name:'Zuri J.',avatar:'ZJ',color:'#a16d83',text:'Espresso French tips + gold hardware. Brown-on-brown nail looks are underrated.',tags:['Nails','French tips'],likes:171,comments:[]},
  {id:'seed-4',name:'Sade M.',avatar:'SM',color:'#795443',text:'Your undertone isn’t your skin depth. Two deep skin tones can have totally different red, golden or olive undertones.',tags:['Undertones','Education'],likes:386,comments:[]},
  {id:'seed-5',name:'Imani W.',avatar:'IW',color:'#925b55',text:'Wash-and-go days, twist-out days, wig days: textured hair has no single “correct” style.',tags:['Natural hair','Self-expression'],likes:246,comments:[]}
];

function el(id){return document.getElementById(id)}
function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function storeGet(k,fallback){try {const val=JSON.parse(localStorage.getItem(ROOT+'-'+k));return val===null?fallback:val} catch{return fallback}}
function storeSet(k,value){try{localStorage.setItem(ROOT+'-'+k,JSON.stringify(value));return true}catch{toast('Browser storage is unavailable. Changes will last until you close this page.');return false}}
const savedInit=storeGet('favs',[]);
const looksInit=storeGet('looks',[]);
const postsInit=storeGet('posts',[]);
const likesInit=storeGet('likes',[]);
const followsInit=storeGet('follows',[]);
const passportInit=storeGet('passport',null);
const safePassport=passportInit && typeof passportInit==='object'?passportInit:{};
const accepted=(value,choices)=>choices.includes(value)?value:'all';
const hiddenInit=storeGet('hiddenPosts',[]);
const mutedInit=storeGet('mutedAuthors',[]);
const state={
  category:'all',depth:accepted(safePassport.depth,['all','deep','tan','medium','light']),undertone:accepted(safePassport.undertone,['all','warm','cool','neutral','olive']),texture:accepted(safePassport.texture,['all','3b','4a','4b','4c','braids','locs','protective']),sort:'featured',search:'',
  studioRegion:'lips',currentId:'lips-0',mode:'photo',intensity:65,size:100,
  favs:new Set(Array.isArray(savedInit)?savedInit:[]),
  looks:Array.isArray(looksInit)?looksInit:[],
  posts:Array.isArray(postsInit)?postsInit:[],
  likes:new Set(Array.isArray(likesInit)?likesInit:[]),
  follows:new Set(Array.isArray(followsInit)?followsInit:[]),
  hiddenPosts:new Set(Array.isArray(hiddenInit)?hiddenInit.filter(x=>typeof x==='string'):[]),
  mutedAuthors:new Set(Array.isArray(mutedInit)?mutedInit.filter(name=>POSTS.some(p=>p.name===name)):[]),
  layers:{},artistFilter:'all',uploadedPhoto:null,photoPos:{x:47,y:57}
};
const itemById=id=>ITEMS.find(i=>i.id===id);
function toast(message){const box=el('toast');box.textContent=message;box.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('visible'),3600)}
function navigate(name){
  if(!el(name)||!el(name).classList.contains('view'))return;
  if(name!=='studio')stopCamera();
  document.querySelectorAll('.view').forEach(node=>node.classList.toggle('active',node.id===name));
  document.querySelectorAll('.nav-item').forEach(node=>{const active=node.dataset.go===name;node.classList.toggle('current',active);if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current')});
  if(name==='explore')renderExplore();
  if(name==='saved')renderSaved();
  if(name==='community')renderCommunity();
  if(name==='artists')renderArtists();
  if(name==='studio')renderStudio();
  if(window.location.hash.slice(1)!==name)history.replaceState(null,'','#'+name);
  window.scrollTo({top:0,behavior:'instant'});
}
function thumb(item){return '<div class="product-art" style="--swatch:'+item.color+';--card-bg:'+(
  item.category==='hair'?'#e1d3c8':item.category==='nails'?'#e6d4de':'#f1dfd7')+'"><span class="art-label">'+esc(item.region)+'</span><div class="art-center" aria-hidden="true"></div></div>'}
function itemCard(item){
  const tags=item.tags.slice(0,2).map(t=>'<span>'+esc(t)+'</span>').join('');
  return '<article class="product-card" data-category="'+item.category+'"><div style="position:relative">'+thumb(item)+'<button class="product-heart '+(state.favs.has(item.id)?'active':'')+'" data-fav="'+item.id+'" aria-label="'+(state.favs.has(item.id)?'Remove from':'Add to')+' favorites" aria-pressed="'+state.favs.has(item.id)+'">'+(state.favs.has(item.id)?'♥':'♡')+'</button></div><div class="product-body"><div class="product-sub">'+esc(item.category)+' · '+esc(item.region)+'</div><h3>'+esc(item.name)+'</h3><p>'+esc(item.desc)+'</p><div class="product-tags">'+tags+'</div><button class="try-btn" data-try="'+item.id+'">Try this look ↗</button></div></article>';
}
let catalogIntakeGeneration=0,catalogEvidenceKit=null;
function renderSupplierReviewSummary(){
  const status=el('supplierReviewStatus'),exportButton=el('supplierReviewExport'),resetButton=el('supplierReviewReset');
  const report=catalogEvidenceKit?.snapshot();
  if(!report||!report.records.length){
    status.textContent='Load a candidate feed to prepare a supplier evidence packet. Approved: 0. Published: 0.';
    exportButton.disabled=true;resetButton.disabled=true;return;
  }
  const marks=report.records.flatMap(row=>Object.values(row.requirements));
  const claimed=marks.filter(x=>x==='claimed_unverified').length;
  const unresolved=marks.filter(x=>x==='needs_review').length;
  status.textContent=report.records.length+' candidate'+(report.records.length===1?'':'s')+
    ' · '+claimed+' claimed evidence item'+(claimed===1?'':'s')+
    ' (not independently checked) · '+unresolved+' disputed item'+(unresolved===1?'':'s')+
    '. Verification: not performed. Approved: 0. Published: 0.';
  exportButton.disabled=false;resetButton.disabled=false;
}
function resetSupplierReview(){
  if(catalogEvidenceKit)catalogEvidenceKit.reset();
  for(const select of el('catalogIntakeResults').querySelectorAll('select[data-supplier-requirement]')){
    select.value='not_provided';
  }
  renderSupplierReviewSummary();
}
function downloadSupplierReview(){
  const packet=catalogEvidenceKit?.snapshot();
  if(!packet||!packet.records.length)return;
  try{
    const blob=new Blob([JSON.stringify(packet,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='glow-society-supplier-review-unverified.json';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    toast('Review packet downloaded. No supplier proof has been verified or approved.');
  }catch{toast('The browser could not download the review packet.')}
}
function resetCatalogReview(){
  catalogEvidenceKit=null;
  catalogIntakeGeneration++;
  el('catalogFile').value='';
  el('catalogIntakeResults').replaceChildren();
  el('catalogIntakeStatus').textContent='No supplier feed loaded. Approved: 0. Published: 0.';
  renderSupplierReviewSummary();
}
function showCatalogReview(report,isExample=false){
  catalogEvidenceKit=null;
  const output=el('catalogIntakeResults');
  output.replaceChildren();
  if(report.error){
    el('catalogIntakeStatus').textContent='Review failed: '+report.error+'. Approved: 0. Published: 0.';
    renderSupplierReviewSummary();
    return;
  }
  catalogEvidenceKit=window.GlowSupplierReview.create(report.items);
  el('catalogIntakeStatus').textContent=(isExample?'Fictional example. ':'Unverified local input. ')+
    report.items.length+' structurally reviewable, '+report.rejected.length+
    ' rejected. Supplier proof: unverified. Approved: 0. Published: 0.';
  if(!report.items.length&&!report.rejected.length){
    const empty=document.createElement('p');empty.textContent='The feed is empty; nothing is ready for review.';
    output.appendChild(empty);
  }
  for(const candidate of report.items){
    const card=document.createElement('article');card.className='catalog-review-item';
    const heading=document.createElement('h4');heading.textContent=candidate.brand+' — '+candidate.name;
    const meta=document.createElement('p');meta.textContent='SKU: '+candidate.sku+' · Category: '+candidate.category+
      ' · Tags: '+(candidate.tags.join(', ')||'none');
    const source=document.createElement('p');source.className='catalog-source';
    source.textContent='Unverified source reference (not opened): '+candidate.sourceUrl;
    const status=document.createElement('p');status.className='catalog-blocked';
    status.textContent='Needs independent provenance and owner approval · Not available for sale';
    card.append(heading,meta,source,status);
    const proof=document.createElement('fieldset');proof.className='supplier-evidence';
    const legend=document.createElement('legend');legend.textContent='Evidence tracking (unverified; cannot approve)';
    proof.appendChild(legend);
    for(const rule of window.GlowSupplierReview.REQUIREMENTS){
      const label=document.createElement('label');label.className='supplier-evidence-row';
      const heading=document.createElement('span');heading.textContent=rule.label;
      const hint=document.createElement('small');hint.textContent=rule.question;
      const select=document.createElement('select');
      select.dataset.supplierSku=candidate.sku;
      select.dataset.supplierRequirement=rule.id;
      select.setAttribute('aria-label',rule.label+' for '+candidate.name);
      for(const option of window.GlowSupplierReview.statuses){
        const node=document.createElement('option');node.value=option.value;node.textContent=option.label;
        select.appendChild(node);
      }
      label.append(heading,hint,select);proof.appendChild(label);
    }
    card.appendChild(proof);output.appendChild(card);
  }
  for(const invalid of report.rejected){
    const row=document.createElement('p');row.className='catalog-rejected';
    row.textContent='Row '+invalid.row+' rejected: '+invalid.reason;output.appendChild(row);
  }
  renderSupplierReviewSummary();
}
async function loadCatalogFile(){
  const file=el('catalogFile').files?.[0];
  if(!file)return;
  const generation=++catalogIntakeGeneration;
  catalogEvidenceKit=null;
  el('catalogIntakeResults').replaceChildren();renderSupplierReviewSummary();
  el('catalogIntakeStatus').textContent='Reading local feed for schema review; nothing has been uploaded.';
  if(!file.name.toLowerCase().endsWith('.json')||file.size>window.GlowCatalogIntake.maxBytes){
    if(generation===catalogIntakeGeneration)showCatalogReview({error:'Select a .json file no larger than 64 KiB'});
    return;
  }
  try{
    const raw=await file.text();
    if(generation!==catalogIntakeGeneration)return;
    showCatalogReview(window.GlowCatalogIntake.parse(raw));
  }catch{
    if(generation===catalogIntakeGeneration)showCatalogReview({error:'The local file could not be read'});
  }
}
function downloadCatalogExample(){
  const payload=JSON.stringify(window.GlowCatalogIntake.sample,null,2);
  try{
    const blob=new Blob([payload],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='glow-society-catalog-example.json';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    toast('Fictional schema example downloaded. It is not a real supplier feed.');
  }catch{toast('The browser could not download the example feed.')}
}
function beautyMatchSettings(){
  return {
    category:el('matchCategory').value,
    depth:el('matchDepth').value,
    tone:el('matchTone').value,
    texture:el('matchTexture').value,
    vibe:el('matchVibe').value
  };
}
function renderBeautyMatch(){
  const prefs=beautyMatchSettings();
  const matches=window.GlowBeautyMatch.recommend(ITEMS,prefs);
  const status=el('matchStatus');
  const grid=el('matchResults');
  grid.replaceChildren();
  if(!matches.length){
    status.textContent='No concepts carry every selected tag. Try a different combination. No shade match was inferred.';
    return;
  }
  status.textContent=matches.length+' illustrative look'+(matches.length===1?'':'s')+
    ' selected from 47 fictional concepts. These are tag-based suggestions, not measured shade or hairstyle matches.';
  // Reuse the same favorites and Studio actions as the rest of the catalog.
  for(const suggestion of matches){
    const item=itemById(suggestion.id);
    if(!item)continue;
    const wrapper=document.createElement('div');
    wrapper.className='beauty-match-result';
    wrapper.innerHTML=itemCard(item);
    const explanation=document.createElement('p');
    explanation.className='beauty-match-why';
    explanation.textContent='Why shown: '+suggestion.reason+'.';
    wrapper.appendChild(explanation);
    grid.appendChild(wrapper);
  }
}
function resetBeautyMatch(){
  el('beautyMatchForm').reset();
  el('matchResults').replaceChildren();
  el('matchStatus').textContent='Choose what matters to you, then select Find my demo looks.';
}
function renderTrending(){
  el('trendingGrid').innerHTML=['lips-1','hair-1','nails-0','cheeks-1','hair-0','lips-2','nails-3','hair-2'].map(id=>itemCard(itemById(id))).join('');
}
function renderExplore(){
  el('categoryChips').innerHTML=[['all','All looks'],['makeup','Makeup'],['hair','Hair'],['nails','Nails']].map(([v,label])=>'<button class="chip '+(state.category===v?'selected':'')+'" data-explorecat="'+v+'" aria-pressed="'+(state.category===v)+'">'+label+'</button>').join('');
  let results=ITEMS.filter(item=>{
    if(state.category!=='all'&&item.category!==state.category)return false;
    if(item.category==='makeup'){
      if(state.depth!=='all'&&!item.tags.includes(state.depth))return false;
      if(state.undertone!=='all'&&!item.tags.includes(state.undertone))return false;
    }
    if(item.category==='hair'&&state.texture!=='all'&&!item.tags.includes(state.texture))return false;
    const hay=(item.name+' '+item.desc+' '+item.category+' '+item.region+' '+item.tags.join(' ')).toLowerCase();
    return !state.search||hay.includes(state.search);
  });
  if(state.sort==='name')results.sort((a,b)=>a.name.localeCompare(b.name));
  if(state.sort==='category')results.sort((a,b)=>a.category.localeCompare(b.category));
  el('resultCount').textContent=results.length+' demo looks · skin filters apply to makeup, texture filters to hair';
  el('exploreGrid').innerHTML=results.length?results.map(itemCard).join(''):'<div class="empty-state"><strong>No matches yet.</strong><p>Try another search or remove some filters.</p><button class="cta dark" data-resetfilters>Clear filters</button></div>';
}
function toggleFav(id){
  if(!itemById(id))return;
  if(state.favs.has(id))state.favs.delete(id);else state.favs.add(id);
  storeSet('favs',[...state.favs]);
  refreshFavs();toast(state.favs.has(id)?'Added to your private favorites':'Removed from favorites');
}
function refreshFavs(){
  el('favCount').textContent=state.favs.size;el('favCount').hidden=!state.favs.size;
  renderTrending();if(el('explore').classList.contains('active'))renderExplore();
  if(el('saved').classList.contains('active'))renderSaved();
  if(el('studio').classList.contains('active'))updateStudioDetail();
}
function renderSaved(){
  const favs=[...state.favs].map(itemById).filter(Boolean);
  el('savedGrid').innerHTML=favs.length?favs.map(itemCard).join(''):'<div class="empty-state"><strong>Nothing saved yet.</strong><p>Tap a heart to collect the looks you love.</p><button class="cta dark" data-go="explore">Explore beauty ↗</button></div>';
  el('looksGrid').innerHTML=state.looks.length?state.looks.map(look=>{
    const colors=Object.values(look.layers||{}).map(id=>itemById(id)).filter(Boolean);
    return '<article class="look-card"><div class="look-colors">'+colors.map(i=>'<span style="background:'+i.color+'"></span>').join('')+'</div><h3>'+esc(look.title||'My look')+'</h3><small>'+colors.map(i=>esc(i.name)).join(' · ')+'</small><button data-loadlook="'+esc(look.id)+'">Try this saved look</button> <button data-deletelook="'+esc(look.id)+'">Delete</button></article>'
  }).join(''):'<div class="empty-state"><strong>Your future looks live here.</strong><p>Build a combination in the try-on studio and save it.</p></div>';
  updatePrivacySummary();
}
function updatePrivacySummary(){
  const counts=[
    state.favs.size+' favorites',
    state.looks.length+' saved looks',
    state.posts.filter(p=>p.local).length+' private posts',
    state.hiddenPosts.size+' hidden posts',
    state.mutedAuthors.size+' muted demo creators'
  ];
  el('privacySummary').textContent=counts.join(' · ')+'. Beauty Passport, comments, likes and follow preferences are also covered by export and erase.';
}
function localDataSnapshot(){
  const prefix=ROOT+'-';
  const data={};
  for(const key of Object.keys(localStorage)){
    if(!key.startsWith(prefix))continue;
    const raw=localStorage.getItem(key);
    try{data[key.slice(prefix.length)]=JSON.parse(raw)}catch{data[key.slice(prefix.length)]=raw}
  }
  return data;
}
function exportPrivateData(){
  try{
    const snapshot={product:'Glow Society',schemaVersion:1,exportedAt:new Date().toISOString(),scope:'browser-local-demo-data-only',data:localDataSnapshot()};
    const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download='glow-society-private-data.json';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    toast('Local data exported to a JSON file on this device. Keep it private.');
  }catch{
    toast('Data export could not start. Your browser may restrict downloads or local storage.');
  }
}
function erasePrivateData(){
  let keys=[];
  try{
    keys=Object.keys(localStorage).filter(k=>k.startsWith(ROOT+'-'));
    for(const key of keys)localStorage.removeItem(key);
    if(keys.some(k=>localStorage.getItem(k)!==null))throw new Error('Stored values remain');
  }catch{
    toast('Could not fully clear this browser’s storage. Check browser site-data settings.');
    el('eraseConfirm').hidden=true;
    return;
  }
  stopCamera();resetArHealth();validationKit.clear();observedModeStats={face:null,hand:null};renderValidationStatus();
  if(uploadedUrl){URL.revokeObjectURL(uploadedUrl);uploadedUrl=null}
  photo.src=DEMO_PHOTO;photo.dataset.fallback='';el('photoFile').value='';
  state.favs.clear();state.looks=[];state.posts=[];state.likes.clear();state.follows.clear();
  state.hiddenPosts.clear();state.mutedAuthors.clear();state.layers={};state.uploadedPhoto=null;
  state.depth='all';state.undertone='all';state.texture='all';state.category='all';state.search='';state.sort='featured';
  state.artistFilter='all';state.mode='photo';state.studioRegion='lips';state.currentId='lips-0';
  state.size=100;state.intensity=65;state.photoPos={x:47,y:57};
  el('search').value='';el('depthFilter').value='all';el('toneFilter').value='all';el('textureFilter').value='all';el('sortFilter').value='featured';
  el('postText').value='';el('postLength').textContent='0 / 280';
  resetBeautyMatch();
  resetCatalogReview();
  el('overlaySize').value='100';el('intensity').value='65';el('overlayNumber').textContent='100%';el('intensityNumber').textContent='65%';
  el('passportStatus').textContent='No preferences saved yet';
  el('eraseConfirm').hidden=true;
  refreshFavs();renderExplore();renderArtists();renderCommunity();renderStudio();navigate('saved');updatePrivacySummary();
  toast('Glow Society demo data erased from this browser. Other site data was not touched.');
}
function renderCommunity(){
  const all=[...state.posts.slice().reverse(),...POSTS.filter(p=>!state.posts.some(local=>local.id===p.id))].filter(p=>!state.hiddenPosts.has(p.id) && (p.local || !state.mutedAuthors.has(p.name)));
  el('feed').innerHTML=all.map(p=>{
    const local=!!p.local;const liked=state.likes.has(p.id);
    const total=p.likes+(liked?1:0);
    const comments=(p.comments||[]).map(c=>'<p><strong>'+esc(c.by)+':</strong> '+esc(c.text)+'</p>').join('');
    return '<article class="post" data-post="'+esc(p.id)+'"><div class="post-head"><div class="avatar" style="background:'+esc(p.color||'#6e526c')+'">'+esc(p.avatar)+'</div><div><strong>'+esc(p.name)+'</strong><small>'+(local?'My private draft':'Demo inspiration')+'</small></div></div><p class="post-body">'+esc(p.text)+'</p><div class="post-chips">'+(p.tags||[]).map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><div class="post-actions"><button data-like="'+esc(p.id)+'" class="'+(liked?'liked':'')+'" aria-pressed="'+liked+'">'+(liked?'♥':'♡')+' '+total+' likes</button><button data-togglecomments="'+esc(p.id)+'">✎ '+(p.comments||[]).length+' comments</button>'+(local?'<button data-deletepost="'+esc(p.id)+'">Delete</button>':'')+'<button data-hidepost="'+esc(p.id)+'" aria-label="Hide this demo post locally">Hide</button>'+(local?'':'<button data-muteauthor="'+esc(p.name)+'" aria-label="Mute this fictional demo creator locally">Mute creator</button>')+'</div><div class="comments" id="comments-'+esc(p.id)+'" hidden>'+comments+'<form class="comment-form" data-commentform="'+esc(p.id)+'"><input maxlength="180" placeholder="Add a private demo comment…" aria-label="Add a comment" required/><button type="submit">Add</button></form></div></article>';
  }).join('');
}
function findPost(id){return state.posts.find(p=>p.id===id)||POSTS.find(p=>p.id===id)}
function renderArtists(){
  const categories=[['all','All artists'],['makeup','Makeup'],['hair','Hair'],['nails','Nails']];
  el('artistFilters').innerHTML=categories.map(([v,label])=>'<button class="chip '+(state.artistFilter===v?'selected':'')+'" data-artistfilter="'+v+'">'+label+'</button>').join('');
  const artists=ARTISTS.filter(a=>state.artistFilter==='all'||a.specialty===state.artistFilter);
  el('artistGrid').innerHTML=artists.map(a=>'<article class="artist-card"><div class="avatar" style="background:'+a.color+'">'+a.name.split(' ').map(n=>n[0]).join('')+'</div><div class="kicker">'+esc(a.city)+'</div><h3>'+esc(a.name)+'</h3><p><strong>'+esc(a.role)+'</strong></p><p>'+esc(a.bio)+'</p><div class="artist-specialties">'+a.tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><button class="try-btn" data-follow="'+esc(a.id)+'">'+(state.follows.has(a.id)?'Following in demo ✓':'Follow in demo +')+'</button><div class="artist-note">Illustrative creator · not a verified professional</div></article>').join('');
}

const studioRegions=[['lips','Lips'],['cheeks','Blush'],['eyes','Eyes'],['hair','Hair'],['nails','Nails']];
function renderStudio(){
  if(state.mode==='face'&&!['lips','cheeks'].includes(state.studioRegion))state.studioRegion='lips';
  if(state.mode==='hand'&&state.studioRegion!=='nails')state.studioRegion='nails';
  if(!itemById(state.currentId)||itemById(state.currentId).region!==state.studioRegion){
    state.currentId=ITEMS.find(i=>i.region===state.studioRegion).id;
  }
  el('studioCategoryChips').innerHTML=studioRegions.map(([v,label])=>'<button class="chip '+(state.studioRegion===v?'selected':'')+'" data-studiocat="'+v+'">'+label+'</button>').join('');
  const choices=ITEMS.filter(i=>i.region===state.studioRegion);
  el('studioItem').innerHTML=choices.map(i=>'<option value="'+i.id+'" '+(i.id===state.currentId?'selected':'')+'>'+esc(i.name)+' — '+esc(i.desc)+'</option>').join('');
  document.querySelectorAll('.studio-tab').forEach(b=>{const selected=b.dataset.mode===state.mode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});
  const isPhoto=state.mode==='photo';
  el('photoLab').hidden=!isPhoto;el('cameraLab').hidden=isPhoto;el('startCamera').hidden=isPhoto||!!cameraStream;el('stopCamera').hidden=isPhoto||!cameraStream;
  el('photoFile').closest('label').hidden=!isPhoto;
  el('manualControls').hidden=!isPhoto;
  // The front camera is mirrored for lipstick/blush; the rear hand camera is not.
  const mirrored=state.mode==='face';
  video.style.transform=mirrored?'scaleX(-1)':'none';
  canvas.style.transform=mirrored?'scaleX(-1)':'none';
  updateStudioDetail();
}
function updateStudioDetail(){
  const item=itemById(state.currentId);if(!item)return;
  el('selectedSwatch').style.background=item.color;
  el('selectedName').textContent=item.name;el('selectedDesc').textContent=item.desc;
  el('favoriteCurrent').textContent=state.favs.has(item.id)?'♥':'♡';
  el('favoriteCurrent').setAttribute('aria-pressed',String(state.favs.has(item.id)));
  const overlay=el('manualOverlay');
  overlay.dataset.region=item.region;
  overlay.style.background=item.color;
  overlay.style.opacity=String(Math.max(.15,state.intensity/100*.85));
  overlay.style.transform='translate(-50%, -50%) scale('+(state.size/100)+')';
  overlay.style.left=state.photoPos.x+'%';
  overlay.style.top=state.photoPos.y+'%';
  renderLookStack();
}
function renderLookStack(){
  const choices=Object.values(state.layers).map(itemById).filter(Boolean);
  const stack=el('lookStack');
  if(!stack)return;
  stack.innerHTML='<div class="field-label" style="margin-top:18px">Your look layers <span>'+choices.length+' selected</span></div><div class="look-chips">'+(choices.length?choices.map(i=>'<button class="look-chip" style="--look-color:'+i.color+'" data-try="'+i.id+'"><span></span>'+esc(i.name)+'</button>').join(''):'<span class="hint">Choosing shades adds them to your look.</span>')+'</div><button type="button" class="text-link" data-clearlook>Clear layers</button>';
}
function pickItem(id,goStudio){
  const item=itemById(id);if(!item)return;
  state.currentId=id;state.studioRegion=item.region;state.layers[item.region]=id;
  if((state.mode==='face'&&!['lips','cheeks'].includes(item.region))||(state.mode==='hand'&&item.region!=='nails'))switchMode('photo');
  const defaults={lips:[47,57],cheeks:[34,47],eyes:[37,36],hair:[50,24],nails:[60,67]};
  state.photoPos={x:defaults[item.region][0],y:defaults[item.region][1]};
  if(goStudio)navigate('studio');else renderStudio();
}
function switchMode(mode){
  if(state.mode!==mode)stopCamera();
  state.mode=mode;
  if(mode==='face'&&!['lips','cheeks'].includes(state.studioRegion))state.studioRegion='lips';
  if(mode==='hand')state.studioRegion='nails';
  renderStudio();
}
function saveLook(){
  const item=itemById(state.currentId);
  if(!item)return;
  state.layers[item.region]=item.id;
  const layers={...state.layers};
  const n=Object.keys(layers).length;
  const look={id:'look-'+Date.now()+'-'+Math.random().toString(36).slice(2,5),title:n>1?'My '+n+'-piece glow':'My '+item.name+' look',layers,date:new Date().toISOString()};
  state.looks.unshift(look);state.looks=state.looks.slice(0,40);
  storeSet('looks',state.looks);toast('Saved to your private lookbook');
}
function loadLook(id){
  const look=state.looks.find(l=>l.id===id);if(!look)return;
  state.layers={...look.layers};
  const selected=Object.values(state.layers).map(itemById).find(Boolean);
  if(selected){state.mode='photo';state.currentId=selected.id;state.studioRegion=selected.region;navigate('studio');toast('Saved combination loaded. Pick a layer to preview.')}
}
const photo=el('previewPhoto');photo.src=DEMO_PHOTO;
photo.addEventListener('error',()=>{
  if(photo.dataset.fallback)return;
  photo.dataset.fallback='true';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#6a4252"/><stop offset="1" stop-color="#d5a18b"/></linearGradient></defs><rect width="600" height="720" fill="url(#g)"/><circle cx="300" cy="290" r="185" fill="#4f312c"/><ellipse cx="300" cy="340" rx="125" ry="160" fill="#794636"/><ellipse cx="250" cy="323" rx="10" ry="5" fill="#261c22"/><ellipse cx="350" cy="323" rx="10" ry="5" fill="#261c22"/><path d="M270 414 Q300 425 330 414" stroke="#48252e" stroke-width="8" fill="none"/></svg>';
  photo.removeAttribute('crossorigin');
  photo.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
});
let uploadedUrl=null;
el('photoFile').addEventListener('change',e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Use JPG, PNG, or WEBP for your photo.');return}
  if(file.size>10*1024*1024){toast('Choose a photo under 10 MB.');return}
  if(uploadedUrl)URL.revokeObjectURL(uploadedUrl);
  uploadedUrl=URL.createObjectURL(file);state.uploadedPhoto=uploadedUrl;photo.src=uploadedUrl;
  toast('Photo stays on your device. Drag the overlay to position it.');
});
el('resetPreview').addEventListener('click',()=>{
  if(uploadedUrl){URL.revokeObjectURL(uploadedUrl);uploadedUrl=null}
  el('photoFile').value='';photo.src=DEMO_PHOTO;photo.dataset.fallback='';
  state.uploadedPhoto=null;state.size=100;state.intensity=65;state.layers={};state.photoPos={x:47,y:57};
  el('overlaySize').value='100';el('intensity').value='65';el('overlayNumber').textContent='100%';el('intensityNumber').textContent='65%';
  if(state.mode!=='photo')stopCamera();
  switchMode('photo');toast('Preview reset');
});
const overlay=el('manualOverlay');
let dragging=false;
overlay.addEventListener('pointerdown',e=>{dragging=true;overlay.setPointerCapture(e.pointerId);e.preventDefault()});
overlay.addEventListener('pointermove',e=>{
  if(!dragging)return;
  const rect=el('photoFrame').getBoundingClientRect();
  state.photoPos.x=Math.max(7,Math.min(93,(e.clientX-rect.left)*100/rect.width));
  state.photoPos.y=Math.max(8,Math.min(92,(e.clientY-rect.top)*100/rect.height));
  updateStudioDetail();
});
overlay.addEventListener('pointerup',()=>dragging=false);
overlay.addEventListener('pointercancel',()=>dragging=false);
overlay.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();state.photoPos.x+=e.key==='ArrowRight'?2:e.key==='ArrowLeft'?-2:0;
  state.photoPos.y+=e.key==='ArrowDown'?2:e.key==='ArrowUp'?-2:0;
  state.photoPos.x=Math.max(7,Math.min(93,state.photoPos.x));
  state.photoPos.y=Math.max(8,Math.min(92,state.photoPos.y));updateStudioDetail();
});
el('intensity').addEventListener('input',e=>{state.intensity=Number(e.target.value);el('intensityNumber').textContent=state.intensity+'%';updateStudioDetail()});
el('overlaySize').addEventListener('input',e=>{state.size=Number(e.target.value);el('overlayNumber').textContent=state.size+'%';updateStudioDetail()});
el('studioItem').addEventListener('change',e=>pickItem(e.target.value,false));
el('favoriteCurrent').addEventListener('click',()=>toggleFav(state.currentId));
el('saveLook').addEventListener('click',saveLook);

let cameraStream=null,landmarker=null,raf=0,cameraGeneration=0,lastFrame=0,mediaPipeModule=null;
let arSession=null,arLastSummary=null;
const validationKit=window.GlowValidationKit.create();
let observedModeStats={face:null,hand:null};
let cameraStarting=false,cameraCheckPending=false;
const video=el('cameraVideo'),canvas=el('cameraCanvas');
const lipOuter=[61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185];
const lipInner=[78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191];
function cameraStatus(s,msg){el('cameraStatus').textContent=s;el('cameraMessage').textContent=msg||'';el('cameraMessage').hidden=!msg}
function renderArHealth(ended=false){
  const report=arSession?arSession.snapshot():arLastSummary;
  const panel=el('arHealthStatus'),button=el('exportArHealth');
  if(!report || !report.samples){
    panel.textContent='Not measured. Start a live face or hand session to collect observations.';
    panel.dataset.status='unmeasured';button.disabled=true;return;
  }
  const sessionEnded=ended||(!arSession && !!arLastSummary);
  panel.dataset.status=report.validity;
  const pct=report.detectionPercent===null?'n/a':report.detectionPercent+'%';
  const processing=report.meanInferenceMs===null?'n/a':report.meanInferenceMs+' ms';
  const rate=report.sampleRateHz===null?'n/a':report.sampleRateHz+' samples/sec';
  panel.textContent=(sessionEnded?'Session ended. ':'Session running. ')+
    report.mode+' · '+report.samples+' sampled frames · '+report.detectedSamples+' detected ('+pct+
    ') · mean detection time '+processing+' · sampling rate '+rate+'. '+
    (report.validity==='insufficient-samples'?'Insufficient samples for preliminary diagnostics. ':
    'Observational result only. ')+
    'No shade accuracy or fit certification.';
  button.disabled=false;
}
function resetArHealth(){arSession=null;arLastSummary=null;renderArHealth()}
function exportArHealth(){
  const report=arSession?arSession.snapshot():arLastSummary;
  if(!report||!report.samples)return;
  try{
    const blob=new Blob([JSON.stringify({scope:'local-session-metrics-only',...report},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='glow-society-ar-session.json';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    toast('AR sample counts exported without photos, landmarks or device identifiers.');
  }catch{toast('This browser could not export session statistics.')}
}
function validationEvidence(mode){
  const live=arSession?.snapshot();
  return live?.mode===mode&&live.samples>0?live:observedModeStats[mode];
}
function renderValidationKit(){
  const container=el('validationScenarios');
  container.replaceChildren();
  const options=[['not-tested','Not tested'],['looks-aligned','Appears aligned (self-reported)'],['needs-review','Needs review']];
  for(const scenario of window.GlowValidationKit.scenarios){
    const row=document.createElement('div');row.className='validation-row';
    const label=document.createElement('label');label.textContent=scenario.label;
    const small=document.createElement('small');small.textContent=scenario.guidance;
    const input=document.createElement('select');
    input.dataset.validationId=scenario.id;
    input.setAttribute('aria-label','Observation: '+scenario.label);
    for(const [value,title] of options){
      const option=document.createElement('option');option.value=value;option.textContent=title;input.append(option);
    }
    label.append(small,input);row.append(label);container.append(row);
  }
  renderValidationStatus();
}
function renderValidationStatus(){
  const report=validationKit.snapshot();
  const supported=report.scenarios.filter(s=>validationEvidence(s.mode)?.samples>0);
  for(const entry of report.scenarios){
    const select=el('validationScenarios').querySelector('select[data-validation-id="'+entry.id+'"]');
    if(!select)continue;
    select.disabled=!validationEvidence(entry.mode)?.samples;
    select.value=entry.result;
  }
  const marked=report.scenarios.filter(s=>s.result!=='not-tested'&&validationEvidence(s.mode)?.samples>0);
  const needsReview=marked.filter(s=>s.result==='needs-review').length;
  el('exportValidation').disabled=!marked.length;
  const status=el('validationStatus');
  status.dataset.status=marked.length?'self-reported':'unverified';
  status.textContent=marked.length+' of '+report.scenarios.length+
    ' scenarios marked with matching observed face/hand samples; '+needsReview+
    ' marked needs review. '+supported.length+
    ' scenarios currently enabled by a sampled camera mode. '+
    'No results are independently verified or certified. No personal test data is stored.';
}
function exportValidationReport(){
  const report=validationKit.snapshot();
  const marked=report.scenarios.filter(s=>s.result!=='not-tested'&&validationEvidence(s.mode)?.samples>0);
  if(!marked.length)return;
  try{
    const evidence={};
    for(const mode of ['face','hand']){
      const samples=validationEvidence(mode);
      if(samples?.samples)evidence[mode]=samples;
    }
    const data={
      schema:1,scope:'single-page-device-local-self-report',status:'self-reported-unverified',
      accuracyCertified:false,scenarios:marked,evidence
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='glow-society-ar-observations.json';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    toast('Downloaded self-reported AR observations. No selfies, landmarks or identifiers included.');
  }catch{toast('Could not export observations on this browser.')}
}
function stopCamera(){
  if(arSession){arLastSummary=arSession.snapshot();if(arLastSummary.samples)observedModeStats[arLastSummary.mode]=arLastSummary;arSession=null;renderArHealth(true);renderValidationStatus()}
  cameraGeneration++;cameraStarting=false;cancelAnimationFrame(raf);raf=0;
  if(cameraStream){cameraStream.getTracks().forEach(track=>track.stop());cameraStream=null}
  if(landmarker){try{landmarker.close()}catch{}landmarker=null}
  video.pause();video.srcObject=null;canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  el('startCamera').hidden=state.mode==='photo';el('startCamera').disabled=false;el('stopCamera').hidden=true;
  cameraStatus('CAMERA OFF','Enable your camera to start on-device tracking.');
  if(cameraCheckPending)cameraCheckReport('Camera check cancelled. Any pending permission request will be closed when it resolves.','cancelled');
}
function cameraCheckReport(message,result){
  const area=el('cameraCheckStatus');
  area.dataset.result=result;
  area.textContent=message;
}
async function checkCameraCompatibility(){
  const button=el('runCameraCheck');
  if(cameraStream||cameraStarting||cameraCheckPending){
    cameraCheckReport('Another camera session or check is in progress. Stop it or wait before testing again.','unavailable');
    return;
  }
  const generation=++cameraGeneration;
  cameraCheckPending=true;
  button.disabled=true;
  cameraCheckReport('Checking browser security and requesting a brief camera stream only with your permission…','checking');
  let testStream=null;
  try{
    if(!window.isSecureContext)throw new Error('Camera access requires HTTPS or localhost.');
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)throw new Error('This browser does not expose camera access.');
    testStream=await navigator.mediaDevices.getUserMedia({
      audio:false,video:{facingMode:{ideal:'user'},width:{ideal:640},height:{ideal:480}}
    });
    if(generation!==cameraGeneration)return;
    const tracks=testStream.getVideoTracks();
    if(!tracks.length || tracks[0].readyState!=='live')throw new Error('No active video track was returned.');
    const settings=typeof tracks[0].getSettings==='function'?tracks[0].getSettings():{};
    const resolution=settings.width&&settings.height?settings.width+'×'+settings.height+' frame':'frame dimensions unavailable';
    cameraCheckReport('Camera access verified: a '+resolution+' camera stream started and was stopped. This does not verify face tracking, nails, or shade accuracy.','passed');
  }catch(err){
    if(generation!==cameraGeneration)return;
    const reason=err && err.name==='NotAllowedError'?'Permission was denied or blocked by browser settings.':
      err && err.name==='NotFoundError'?'No matching camera was found.':
      err && err.name==='NotReadableError'?'The camera is busy or unavailable.':
      err && err.message?err.message:'Camera access failed.';
    cameraCheckReport('Camera check not passed: '+reason+' Photo Lab still works without a camera.','unavailable');
  }finally{
    if(testStream)testStream.getTracks().forEach(track=>track.stop());
    cameraCheckPending=false;
    button.disabled=false;
    if(generation!==cameraGeneration && el('cameraCheckStatus').dataset.result==='checking'){
      cameraCheckReport('Check cancelled; camera is off.','cancelled');
    }
  }
}
async function startCamera(){
  if(cameraCheckPending){toast('Wait for the camera check to finish before starting live try-on.');return}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('A secure HTTPS browser and camera permission are needed.');return}
  stopCamera();const gen=++cameraGeneration;
  const requestedMode=state.mode;
  let pendingLandmarker=null;
  cameraStarting=true;
  el('startCamera').disabled=true;
  cameraStatus('LOADING','Requesting permission and loading on-device tracking…');
  try {
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:requestedMode==='hand'?'environment':'user',width:{ideal:640},height:{ideal:480}}});
    if(gen!==cameraGeneration){stream.getTracks().forEach(t=>t.stop());return}
    cameraStream=stream;
    video.srcObject=stream;await video.play();
    if(gen!==cameraGeneration)return;
    if(!mediaPipeModule)mediaPipeModule=await import(ESM);
    if(gen!==cameraGeneration)return;
    const vision=await mediaPipeModule.FilesetResolver.forVisionTasks(WASM);
    if(gen!==cameraGeneration)return;
    const Ctor=requestedMode==='hand'?mediaPipeModule.HandLandmarker:mediaPipeModule.FaceLandmarker;
    const options={baseOptions:{modelAssetPath:requestedMode==='hand'?MODEL_HAND:MODEL_FACE,delegate:'GPU'},runningMode:'VIDEO'};
    if(requestedMode==='hand')options.numHands=1;else options.numFaces=1;
    try{
      pendingLandmarker=await Ctor.createFromOptions(vision,options);
    }catch(error){
      if(gen!==cameraGeneration)return;
      options.baseOptions.delegate='CPU';
      pendingLandmarker=await Ctor.createFromOptions(vision,options);
    }
    if(gen!==cameraGeneration)return;
    landmarker=pendingLandmarker;
    pendingLandmarker=null;
    arSession=window.GlowArMetrics.createSession(requestedMode);
    arLastSummary=null;renderArHealth();
    el('startCamera').hidden=true;el('stopCamera').hidden=false;cameraStatus('LIVE · ON DEVICE','');
    lastFrame=0;
    const loop=(time)=>{
      if(gen!==cameraGeneration||!landmarker)return;
      raf=requestAnimationFrame(loop);
      if(time-lastFrame<65||video.readyState<2)return;lastFrame=time;
      try{drawTracking(time)}catch(error){
        console.warn('AR tracking error',error);
        stopCamera();
        cameraStatus('TRACKING UNAVAILABLE','Try another browser or use photo lab.');
      }
    };
    raf=requestAnimationFrame(loop);
  }catch(error){
    if(gen!==cameraGeneration)return;
    console.warn('Camera not available',error);
    stopCamera();
    cameraStatus('UNAVAILABLE','Camera was denied or tracking could not load. Photo lab is still available.');
    toast('Camera tracking unavailable. The private photo lab still works.');
  }finally{
    // MediaPipe can finish initializing after a user navigates away. Never retain its orphan instance.
    if(pendingLandmarker){try{pendingLandmarker.close()}catch{}}
    if(gen===cameraGeneration)cameraStarting=false;
  }
}
function fillLoop(ctx,pts,indices,w,h){
  indices.forEach((index,i)=>{const p=pts[index];if(i===0)ctx.moveTo(p.x*w,p.y*h);else ctx.lineTo(p.x*w,p.y*h)});ctx.closePath();
}
function drawTracking(time){
  const width=video.videoWidth,height=video.videoHeight;if(!width||!height)return;
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,width,height);
  const inferenceStart=performance.now();
  const results=landmarker.detectForVideo(video,time);
  const pts=state.mode==='hand'?results.landmarks&&results.landmarks[0]:results.faceLandmarks&&results.faceLandmarks[0];
  if(arSession&&arSession.record(performance.now()-inferenceStart,!!pts,time)){
    const snapshot=arSession.snapshot();
    if(snapshot.samples===1||snapshot.samples%10===0){renderArHealth();renderValidationStatus()}
  }
  if(!pts){cameraStatus('LOOKING FOR '+(state.mode==='hand'?'A HAND':'A FACE'),'');return}
  cameraStatus('LIVE · '+(state.mode==='hand'?'HAND':'FACE')+' TRACKED','');
  const alpha=state.intensity/100;
  if(state.mode==='face'){
    const lipItem=itemById(state.layers.lips)||(state.studioRegion==='lips'?itemById(state.currentId):null);
    const cheekItem=itemById(state.layers.cheeks)||(state.studioRegion==='cheeks'?itemById(state.currentId):null);
    if(lipItem){
      ctx.save();ctx.fillStyle=lipItem.color;ctx.globalAlpha=0.28+alpha*.58;
      ctx.filter='blur(1.2px)';ctx.beginPath();fillLoop(ctx,pts,lipOuter,width,height);fillLoop(ctx,pts,lipInner,width,height);ctx.fill('evenodd');ctx.restore();
    }
    if(cheekItem){
      const faceW=Math.abs(pts[454].x-pts[234].x)*width;
      for(const idx of [50,280]){
        const p=pts[idx],x=p.x*width,y=p.y*height,r=Math.max(18,faceW*.17);
        const grad=ctx.createRadialGradient(x,y,0,x,y,r);
        grad.addColorStop(0,cheekItem.color);grad.addColorStop(1,'transparent');
        ctx.save();ctx.globalAlpha=alpha*.43;ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
  } else {
    const nail=itemById(state.layers.nails)||itemById(state.currentId);if(!nail||nail.region!=='nails')return;
    for(const [tip,dip] of [[4,3],[8,7],[12,11],[16,15],[20,19]]){
      const t=pts[tip],d=pts[dip],x=t.x*width,y=t.y*height,dx=(t.x-d.x)*width,dy=(t.y-d.y)*height;
      const len=Math.hypot(dx,dy);if(!len)continue;
      const theta=Math.atan2(dy,dx)+Math.PI/2;
      ctx.save();ctx.translate(x-dx*.23,y-dy*.23);ctx.rotate(theta);
      ctx.fillStyle=nail.color;ctx.globalAlpha=.3+alpha*.65;ctx.beginPath();
      ctx.ellipse(0,0,Math.max(4.5,len*.30),Math.max(8,len*.46),0,0,Math.PI*2);
      ctx.fill();ctx.strokeStyle='#ffffff75';ctx.lineWidth=1;ctx.stroke();ctx.restore();
    }
  }
}
el('runCameraCheck').addEventListener('click',checkCameraCompatibility);
el('startCamera').addEventListener('click',startCamera);
el('stopCamera').addEventListener('click',stopCamera);
el('exportArHealth').addEventListener('click',exportArHealth);
el('exportValidation').addEventListener('click',exportValidationReport);
el('resetValidation').addEventListener('click',()=>{validationKit.clear();renderValidationStatus();toast('Session observation checklist cleared.')});
el('validationScenarios').addEventListener('change',e=>{if(!e.target.matches('select[data-validation-id]'))return;const id=e.target.dataset.validationId,mode=window.GlowValidationKit.scenarios.find(s=>s.id===id)?.mode;if(!mode||!validationEvidence(mode)){e.target.value='not-tested';return}validationKit.setResult(id,e.target.value);renderValidationStatus()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera()});
window.addEventListener('pagehide',()=>{stopCamera();if(uploadedUrl)URL.revokeObjectURL(uploadedUrl)});

// One delegated click handler for all dynamic demo views.
document.addEventListener('click',e=>{
  const target=e.target.closest('button,a[data-go]');if(!target)return;
  if(target.dataset.preset==='deep'){state.depth='deep';state.category='makeup';el('depthFilter').value='deep';navigate('explore');return}
  if(target.dataset.go){e.preventDefault();navigate(target.dataset.go);return}
  if(target.dataset.category){state.category=target.dataset.category;state.depth='all';state.undertone='all';el('depthFilter').value='all';el('toneFilter').value='all';navigate('explore');return}
  if(target.dataset.explorecat){state.category=target.dataset.explorecat;renderExplore();return}
  if(target.dataset.try){pickItem(target.dataset.try,true);return}
  if(target.dataset.fav){toggleFav(target.dataset.fav);return}
  if(target.dataset.mode){switchMode(target.dataset.mode);return}
  if(target.dataset.studiocat){
    if(state.mode==='face'&&!['lips','cheeks'].includes(target.dataset.studiocat))switchMode('photo');
    if(state.mode==='hand'&&target.dataset.studiocat!=='nails')switchMode('photo');
    state.studioRegion=target.dataset.studiocat;
    const id=(ITEMS.find(i=>i.region===state.studioRegion)||{}).id;
    if(id)pickItem(id,false);return;
  }
  if(target.dataset.artistfilter){state.artistFilter=target.dataset.artistfilter;renderArtists();return}
  if(target.dataset.follow){if(state.follows.has(target.dataset.follow))state.follows.delete(target.dataset.follow);else state.follows.add(target.dataset.follow);storeSet('follows',[...state.follows]);renderArtists();toast('Demo follow preference saved to this browser');return}
  if(target.dataset.like){if(state.likes.has(target.dataset.like))state.likes.delete(target.dataset.like);else state.likes.add(target.dataset.like);storeSet('likes',[...state.likes]);renderCommunity();return}
  if(target.dataset.hidepost){state.hiddenPosts.add(target.dataset.hidepost);storeSet('hiddenPosts',[...state.hiddenPosts]);renderCommunity();toast('Post hidden on this device only. No report was submitted.');return}
  if(target.dataset.muteauthor && POSTS.some(p=>p.name===target.dataset.muteauthor)){state.mutedAuthors.add(target.dataset.muteauthor);storeSet('mutedAuthors',[...state.mutedAuthors]);renderCommunity();toast('Fictional creator muted on this device only. No report was submitted.');return}
  if(target.dataset.togglecomments){const comments=el('comments-'+target.dataset.togglecomments);comments.hidden=!comments.hidden;return}
  if(target.dataset.deletepost){state.posts=state.posts.filter(p=>p.id!==target.dataset.deletepost);storeSet('posts',state.posts);renderCommunity();return}
  if(target.dataset.loadlook){loadLook(target.dataset.loadlook);return}
  if(target.dataset.deletelook){state.looks=state.looks.filter(l=>l.id!==target.dataset.deletelook);storeSet('looks',state.looks);renderSaved();return}
  if(target.hasAttribute('data-clearlook')){state.layers={};renderStudio();toast('Look layers cleared');return}
  if(target.hasAttribute('data-resetfilters')){state.category='all';state.depth='all';state.undertone='all';state.texture='all';state.search='';state.sort='featured';el('search').value='';el('depthFilter').value='all';el('toneFilter').value='all';el('textureFilter').value='all';el('sortFilter').value='featured';renderExplore();return}
});
el('headerSaved').addEventListener('click',()=>navigate('saved'));
el('catalogSample').addEventListener('click',()=>{
  catalogIntakeGeneration++;
  el('catalogFile').value='';
  showCatalogReview(window.GlowCatalogIntake.validate(window.GlowCatalogIntake.sample),true);
});
el('catalogFile').addEventListener('change',loadCatalogFile);
el('catalogTemplate').addEventListener('click',downloadCatalogExample);
el('catalogReset').addEventListener('click',resetCatalogReview);
el('supplierReviewExport').addEventListener('click',downloadSupplierReview);
el('supplierReviewReset').addEventListener('click',resetSupplierReview);
el('catalogIntakeResults').addEventListener('change',e=>{
  const select=e.target.closest('select[data-supplier-requirement]');
  if(!select||!catalogEvidenceKit)return;
  if(!catalogEvidenceKit.set(select.dataset.supplierSku,select.dataset.supplierRequirement,select.value)){
    select.value='not_provided';
    return;
  }
  renderSupplierReviewSummary();
});
el('beautyMatchForm').addEventListener('submit',e=>{e.preventDefault();renderBeautyMatch()});
el('matchClear').addEventListener('click',resetBeautyMatch);
el('matchUsePassport').addEventListener('click',()=>{
  el('matchDepth').value=state.depth;
  el('matchTone').value=state.undertone;
  el('matchTexture').value=state.texture;
  renderBeautyMatch();
});
el('search').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();renderExplore()});
el('depthFilter').addEventListener('change',e=>{state.depth=e.target.value;renderExplore()});
el('toneFilter').addEventListener('change',e=>{state.undertone=e.target.value;renderExplore()});
el('textureFilter').addEventListener('change',e=>{state.texture=e.target.value;renderExplore()});
el('savePassport').addEventListener('click',()=>{storeSet('passport',{depth:state.depth,undertone:state.undertone,texture:state.texture});el('passportStatus').textContent='Preferences saved privately on this device';toast('Beauty Passport saved locally; no account needed.')});
el('resetPassport').addEventListener('click',()=>{state.depth='all';state.undertone='all';state.texture='all';state.category='all';state.search='';el('search').value='';for(const id of ['depthFilter','toneFilter','textureFilter'])el(id).value='all';storeSet('passport',null);el('passportStatus').textContent='No preferences saved yet';renderExplore();toast('Beauty Passport reset.')});
el('restoreHidden').addEventListener('click',()=>{state.hiddenPosts.clear();storeSet('hiddenPosts',[]);renderCommunity();toast('Hidden demo posts are visible again.')});
el('restoreMuted').addEventListener('click',()=>{state.mutedAuthors.clear();storeSet('mutedAuthors',[]);renderCommunity();toast('Fictional creators are visible again.')});
el('exportLocalData').addEventListener('click',exportPrivateData);
el('eraseLocalData').addEventListener('click',()=>{el('eraseConfirm').hidden=false;el('confirmEraseLocalData').focus()});
el('cancelEraseLocalData').addEventListener('click',()=>{el('eraseConfirm').hidden=true;el('eraseLocalData').focus()});
el('confirmEraseLocalData').addEventListener('click',erasePrivateData);

el('sortFilter').addEventListener('change',e=>{state.sort=e.target.value;renderExplore()});
el('clearSaved').addEventListener('click',()=>{
  state.favs.clear();storeSet('favs',[]);refreshFavs();toast('Favorites cleared in this browser');
});
el('postText').addEventListener('input',e=>el('postLength').textContent=e.target.value.length+' / 280');
el('postForm').addEventListener('submit',e=>{
  e.preventDefault();const text=el('postText').value.trim();
  if(text.length<3){toast('Add a little more to your post.');return}
  state.posts.push({id:'personal-'+Date.now(),name:'You',avatar:'ME',color:'#75415a',text:text.slice(0,280),tags:['Private demo'],likes:0,comments:[],local:true});
  state.posts=state.posts.slice(-50);storeSet('posts',state.posts);el('postText').value='';el('postLength').textContent='0 / 280';renderCommunity();
  toast('Saved locally. This is not publicly published.');
});
el('feed').addEventListener('submit',e=>{
  const form=e.target.closest('form[data-commentform]');if(!form)return;
  e.preventDefault();const post=findPost(form.dataset.commentform),input=form.querySelector('input');if(!post||!input.value.trim())return;
  // Seed demo posts are cloned to local storage before first comment.
  let local=state.posts.find(p=>p.id===post.id);
  if(!local){local={...post,comments:(post.comments||[]).slice()};state.posts.push(local)}
  local.comments.push({by:'You',text:input.value.trim().slice(0,180)});storeSet('posts',state.posts);
  renderCommunity();el('comments-'+post.id).hidden=false;toast('Comment saved privately on this device');
});
const stack=document.createElement('div');stack.id='lookStack';el('saveLook').closest('.studio-actions').before(stack);
el('depthFilter').value=state.depth;el('toneFilter').value=state.undertone;el('textureFilter').value=state.texture;
if(passportInit)el('passportStatus').textContent='Your saved preferences are active on this device';
refreshFavs();renderArtists();renderCommunity();renderExplore();renderStudio();renderArHealth();renderValidationKit();
const initial=(location.hash||'').slice(1);
navigate(el(initial)&&el(initial).classList.contains('view')?initial:'discover');
})();