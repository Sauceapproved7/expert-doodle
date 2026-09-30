import test from "node:test";
import assert from "node:assert/strict";

import {
  SOUNDWORLD_GIFT_CHOICES,
  createSoundWorldLaunchGiftManifest,
  evaluateSoundWorldGiftEligibility,
  reserveSoundWorldLaunchGift
} from "../hercules-video/soundworld-launch-gift.mjs";
import {createStudioHttpHandler,startStudioServer} from "../hercules-video/studio-server.mjs";

const launchAt="2026-10-01T00:00:00.000Z";

test("launch gift manifest exposes exactly three $0 SoundWorld choices",()=>{
  const manifest=createSoundWorldLaunchGiftManifest({publicPaidLaunchOpenedAt:launchAt,now:"2026-10-02T00:00:00.000Z"});
  assert.equal(manifest.customerPriceCents,0);
  assert.equal(manifest.active,true);
  assert.deepEqual(SOUNDWORLD_GIFT_CHOICES.map(item=>item.code),[
    "soundworld-pods",
    "soundworld-max",
    "soundworld-portable-speaker"
  ]);
  assert.equal(manifest.choices.length,3);
});

test("inactive launch gift manifest uses null timestamps before paid launch opens",()=>{
  const manifest=createSoundWorldLaunchGiftManifest({publicPaidLaunchOpenedAt:null,now:"2026-09-30T01:00:00.000Z"});
  assert.equal(manifest.active,false);
  assert.equal(manifest.startsAt,null);
  assert.equal(manifest.endsAt,null);
});

test("Launch Window Clock is active only inside the first 14 days",()=>{
  const inside=evaluateSoundWorldGiftEligibility({
    purchaseId:"p_1",
    customerId:"c_1",
    productCode:"hercules-titan-founding-access",
    paymentSettled:true,
    verificationPurchase:false,
    purchasedAt:"2026-10-14T23:59:59.999Z",
    publicPaidLaunchOpenedAt:launchAt
  });
  assert.equal(inside.eligible,true);

  const expired=evaluateSoundWorldGiftEligibility({
    purchaseId:"p_2",
    customerId:"c_2",
    productCode:"hercules-titan-founding-access",
    paymentSettled:true,
    verificationPurchase:false,
    purchasedAt:"2026-10-15T00:00:00.000Z",
    publicPaidLaunchOpenedAt:launchAt
  });
  assert.equal(expired.eligible,false);
  assert.equal(expired.reason,"promotion_window_closed");
});

test("verification and unsettled purchases never qualify",()=>{
  const verification=evaluateSoundWorldGiftEligibility({
    purchaseId:"verify_1",
    customerId:"owner",
    productCode:"hercules-titan-founding-access",
    paymentSettled:true,
    verificationPurchase:true,
    purchasedAt:"2026-10-02T00:00:00.000Z",
    publicPaidLaunchOpenedAt:launchAt
  });
  assert.equal(verification.eligible,false);
  assert.equal(verification.reason,"verification_purchase_excluded");

  const unsettled=evaluateSoundWorldGiftEligibility({
    purchaseId:"p_3",
    customerId:"c_3",
    productCode:"hercules-titan-founding-access",
    paymentSettled:false,
    verificationPurchase:false,
    purchasedAt:"2026-10-02T00:00:00.000Z",
    publicPaidLaunchOpenedAt:launchAt
  });
  assert.equal(unsettled.eligible,false);
  assert.equal(unsettled.reason,"payment_not_settled");
});

test("Gift Choice Lock creates one reservation and rejects a duplicate purchase",()=>{
  const purchase={
    purchaseId:"p_4",
    customerId:"c_4",
    productCode:"hercules-titan-founding-access",
    paymentSettled:true,
    verificationPurchase:false,
    purchasedAt:"2026-10-02T00:00:00.000Z"
  };
  const first=reserveSoundWorldLaunchGift({
    purchase,
    giftCode:"soundworld-max",
    publicPaidLaunchOpenedAt:launchAt,
    existingReservations:[]
  });
  assert.equal(first.ok,true);
  assert.equal(first.reservation.giftCode,"soundworld-max");
  assert.equal(first.reservation.customerPriceCents,0);
  assert.equal(first.reservation.status,"reserved");

  const duplicate=reserveSoundWorldLaunchGift({
    purchase,
    giftCode:"soundworld-pods",
    publicPaidLaunchOpenedAt:launchAt,
    existingReservations:[first.reservation]
  });
  assert.equal(duplicate.ok,false);
  assert.equal(duplicate.error,"gift_already_reserved_for_purchase");
});

test("gift reservation endpoint fails closed without authenticated claim authorization",async()=>{
  const handle=createStudioHttpHandler();
  const response=await handle({
    method:"POST",
    pathname:"/api/studio/launch-gift/reserve",
    body:JSON.stringify({purchaseId:"p_5",giftCode:"soundworld-pods"})
  });
  assert.equal(response.status,401);
  assert.equal(JSON.parse(response.body).error,"launch_gift_claim_authorization_required");
});

test("verified customer claim creates one reservation through the Studio backend",async()=>{
  const reservations=[];
  const handle=createStudioHttpHandler({
    authorizeGiftClaim:async request=>request?.headers?.authorization==="Bearer customer-proof",
    launchGiftClockProvider:async()=>launchAt,
    verifyGiftPurchase:async purchaseId=>({
      purchaseId,
      customerId:"c_6",
      productCode:"hercules-titan-founding-access",
      paymentSettled:true,
      verificationPurchase:false,
      purchasedAt:"2026-10-02T00:00:00.000Z"
    }),
    giftReservationStore:{
      list:async()=>reservations,
      create:async reservation=>{reservations.push(reservation);return reservation;}
    }
  });

  const first=await handle({
    method:"POST",
    pathname:"/api/studio/launch-gift/reserve",
    headers:{authorization:"Bearer customer-proof"},
    body:JSON.stringify({purchaseId:"p_6",giftCode:"soundworld-portable-speaker"})
  });
  assert.equal(first.status,201);
  const created=JSON.parse(first.body);
  assert.equal(created.ok,true);
  assert.equal(created.reservation.giftCode,"soundworld-portable-speaker");

  const second=await handle({
    method:"POST",
    pathname:"/api/studio/launch-gift/reserve",
    headers:{authorization:"Bearer customer-proof"},
    body:JSON.stringify({purchaseId:"p_6",giftCode:"soundworld-pods"})
  });
  assert.equal(second.status,409);
  assert.equal(JSON.parse(second.body).error,"gift_already_reserved_for_purchase");
});


test("buyer-facing launch gift page shows all three choices and truthful pre-launch state",async()=>{
  const handle=createStudioHttpHandler({
    launchGiftClockProvider:async()=>null
  });
  const response=await handle({method:"GET",pathname:"/launch-gift"});
  assert.equal(response.status,200);
  assert.match(response.headers["content-type"],/text\/html/);
  assert.match(response.body,/SoundWorld Pods/);
  assert.match(response.body,/SoundWorld Max/);
  assert.match(response.body,/SoundWorld Portable Speaker/i);
  assert.match(response.body,/promotion has not started/i);
  assert.match(response.body,/pre-production/i);
});

test("real HTTP server forwards JSON body and gift adapters into the reservation engine",async()=>{
  const reservations=[];
  const {server}=await startStudioServer({
    host:"127.0.0.1",
    port:0,
    authorizeGiftClaim:async request=>request?.headers?.authorization==="Bearer customer-proof",
    launchGiftClockProvider:async()=>launchAt,
    verifyGiftPurchase:async purchaseId=>({
      purchaseId,
      customerId:"c_http",
      productCode:"hercules-titan-founding-access",
      paymentSettled:true,
      verificationPurchase:false,
      purchasedAt:"2026-10-02T00:00:00.000Z"
    }),
    giftReservationStore:{
      list:async()=>reservations,
      create:async reservation=>{reservations.push(reservation);return reservation;}
    }
  });
  try{
    const address=server.address();
    assert.ok(address && typeof address==="object");
    const response=await fetch(`http://127.0.0.1:${address.port}/api/studio/launch-gift/reserve`,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        authorization:"Bearer customer-proof"
      },
      body:JSON.stringify({purchaseId:"p_http",giftCode:"soundworld-pods"})
    });
    assert.equal(response.status,201);
    const body=await response.json();
    assert.equal(body.ok,true);
    assert.equal(body.reservation.giftCode,"soundworld-pods");
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});
