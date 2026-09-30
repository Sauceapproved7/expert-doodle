const PROMO_DURATION_MS=14*24*60*60*1000;

export const SOUNDWORLD_GIFT_CHOICES=Object.freeze([
  Object.freeze({code:"soundworld-pods",displayName:"SoundWorld Pods"}),
  Object.freeze({code:"soundworld-max",displayName:"SoundWorld Max"}),
  Object.freeze({code:"soundworld-portable-speaker",displayName:"SoundWorld portable speaker"})
]);

const CHOICE_CODES=new Set(SOUNDWORLD_GIFT_CHOICES.map(item=>item.code));

function timestamp(value){
  if(value===null || value===undefined || value==="") return null;
  const ms=new Date(value).getTime();
  return Number.isFinite(ms)?ms:null;
}

function isHerculesPaidOffer(productCode){
  const code=String(productCode||"").trim().toLowerCase();
  return code.startsWith("hercules-")||code.startsWith("studio-");
}

export function createSoundWorldLaunchGiftManifest({
  publicPaidLaunchOpenedAt=null,
  now=new Date().toISOString()
}={}){
  const start=timestamp(publicPaidLaunchOpenedAt);
  const current=timestamp(now);
  const end=start===null?null:start+PROMO_DURATION_MS;
  const active=start!==null&&current!==null&&current>=start&&current<end;

  return {
    schema:"sauceapproved.hercules.soundworld-launch-gift",
    version:1,
    packetVersion:"hercules-soundworld-launch-gift-v1",
    promotion:"Hercules First 14 Days SoundWorld Gift",
    active,
    durationDays:14,
    startsAt:start===null?null:new Date(start).toISOString(),
    endsAt:end===null?null:new Date(end).toISOString(),
    customerPriceCents:0,
    oneGiftPerQualifyingPurchase:true,
    choices:SOUNDWORLD_GIFT_CHOICES.map(item=>({...item})),
    verificationPurchasesExcluded:true,
    fulfillment:{
      mode:"reservation_then_fulfillment",
      hardwareStatus:"pre-production",
      disclosureRequired:true
    }
  };
}

export function evaluateSoundWorldGiftEligibility({
  purchaseId,
  customerId,
  productCode,
  paymentSettled=false,
  verificationPurchase=false,
  purchasedAt,
  publicPaidLaunchOpenedAt
}={}){
  if(!String(purchaseId||"").trim()) return {eligible:false,reason:"purchase_id_required"};
  if(!String(customerId||"").trim()) return {eligible:false,reason:"customer_id_required"};
  if(!isHerculesPaidOffer(productCode)) return {eligible:false,reason:"non_hercules_offer"};
  if(verificationPurchase===true) return {eligible:false,reason:"verification_purchase_excluded"};
  if(paymentSettled!==true) return {eligible:false,reason:"payment_not_settled"};

  const start=timestamp(publicPaidLaunchOpenedAt);
  if(start===null) return {eligible:false,reason:"public_paid_launch_not_open"};

  const purchaseTime=timestamp(purchasedAt);
  if(purchaseTime===null) return {eligible:false,reason:"purchase_timestamp_required"};
  if(purchaseTime<start) return {eligible:false,reason:"purchase_before_launch"};
  if(purchaseTime>=start+PROMO_DURATION_MS) return {eligible:false,reason:"promotion_window_closed"};

  return {
    eligible:true,
    reason:"eligible",
    windowEndsAt:new Date(start+PROMO_DURATION_MS).toISOString()
  };
}

export function reserveSoundWorldLaunchGift({
  purchase,
  giftCode,
  publicPaidLaunchOpenedAt,
  existingReservations=[],
  reservedAt=new Date().toISOString()
}={}){
  const normalizedGiftCode=String(giftCode||"").trim().toLowerCase();
  if(!CHOICE_CODES.has(normalizedGiftCode)){
    return {ok:false,error:"invalid_soundworld_gift_choice"};
  }

  const eligibility=evaluateSoundWorldGiftEligibility({
    ...purchase,
    publicPaidLaunchOpenedAt
  });
  if(!eligibility.eligible){
    return {ok:false,error:eligibility.reason};
  }

  const duplicate=Array.isArray(existingReservations)&&existingReservations.some(
    item=>String(item?.purchaseId||"")===String(purchase.purchaseId||"")
  );
  if(duplicate){
    return {ok:false,error:"gift_already_reserved_for_purchase"};
  }

  const choice=SOUNDWORLD_GIFT_CHOICES.find(item=>item.code===normalizedGiftCode);
  const reservation={
    reservationId:"soundworld-gift:"+String(purchase.purchaseId),
    purchaseId:String(purchase.purchaseId),
    customerId:String(purchase.customerId),
    productCode:String(purchase.productCode),
    giftCode:choice.code,
    giftName:choice.displayName,
    customerPriceCents:0,
    status:"reserved",
    reservedAt:new Date(reservedAt).toISOString(),
    fulfillmentMode:"deferred_until_production_available",
    deferredFulfillmentDisclosureRequired:true
  };

  return {ok:true,reservation,eligibility};
}


function escapeGiftHtml(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

export function renderSoundWorldLaunchGiftPage(manifest){
  const state=manifest?.active===true
    ? `Promotion active through ${manifest.endsAt}.`
    : manifest?.startsAt
      ? "The promotion window has closed."
      : "The promotion has not started yet.";
  const cards=(manifest?.choices||[]).map((choice,index)=>`
    <article class="gift">
      <span>0${index+1}</span>
      <h2>${escapeGiftHtml(choice.displayName)}</h2>
      <p>$0 promotional gift with a qualifying Hercules purchase during the first 14 days of public paid launch.</p>
      <div class="lock">Gift Choice Lock · one verified purchase, one gift</div>
    </article>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Hercules Launch Gift</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050505;color:#f7f7f7}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0,#2b2118 0,#0d0b09 34%,#040404 75%)}
main{width:min(1120px,100%);margin:auto;padding:clamp(18px,4vw,42px)}a{color:#dcb9a1;text-decoration:none}
.hero{padding:clamp(26px,5vw,58px);border:1px solid #3b3027;border-radius:30px;background:linear-gradient(145deg,#19130f,#090909)}
.eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#c99572}
h1{font-size:clamp(44px,9vw,88px);line-height:.92;letter-spacing:-.055em;margin:12px 0 18px}
.lead{max-width:800px;color:#b7b7b7;font-size:clamp(16px,2vw,20px);line-height:1.6}
.state,.disclosure{margin-top:20px;padding:16px 18px;border:1px solid #5a4325;border-radius:16px;background:#1d150d;color:#efca8c;font-weight:750;line-height:1.5}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:18px}
.gift{min-height:260px;padding:24px;border:1px solid #2d2925;border-radius:22px;background:#0c0b0a;display:flex;flex-direction:column}
.gift>span{font-size:11px;letter-spacing:.18em;color:#967a62}.gift h2{font-size:28px;margin:42px 0 12px}.gift p{color:#aaa;line-height:1.55}.lock{margin-top:auto;color:#d4b28d;font-size:12px}
.foot{margin-top:18px;color:#777;font-size:13px;line-height:1.6}
@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{border-radius:22px}.gift{min-height:auto}}
</style>
</head>
<body>
<main>
<a href="/">← SauceApproved Studio</a>
<section class="hero">
<div class="eyebrow">Hercules launch promotion</div>
<h1>Pick your free SoundWorld gift.</h1>
<p class="lead">For the first 14 days after public Hercules paid launch opens, each qualifying settled Hercules purchase gets one $0 SoundWorld gift reservation: Pods, Max, or the portable speaker.</p>
<div class="state">${escapeGiftHtml(state)}</div>
</section>
<section class="grid">${cards}</section>
<div class="disclosure">SoundWorld hardware is currently pre-production. Qualifying buyers reserve their choice first; physical fulfillment begins only after the selected hardware clears production availability. Verification or test purchases do not qualify.</div>
<p class="foot">Choice claiming stays fail-closed until Hercules verifies the purchase and customer authorization. <a href="/pricing">View Hercules Studio pricing</a>.</p>
</main>
</body>
</html>`;
}
