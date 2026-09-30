const PROMO_DURATION_MS=14*24*60*60*1000;

export const SOUNDWORLD_GIFT_CHOICES=Object.freeze([
  Object.freeze({code:"soundworld-pods",displayName:"SoundWorld Pods"}),
  Object.freeze({code:"soundworld-max",displayName:"SoundWorld Max"}),
  Object.freeze({code:"soundworld-portable-speaker",displayName:"SoundWorld portable speaker"})
]);

const CHOICE_CODES=new Set(SOUNDWORLD_GIFT_CHOICES.map(item=>item.code));

function timestamp(value){
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
