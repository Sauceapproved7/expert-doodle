const PILOT_BASE="https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch";

function pilotUrl(content){
  const u=new URL(PILOT_BASE);
  u.searchParams.set("utm_source","studio-market");
  u.searchParams.set("utm_medium","owned");
  u.searchParams.set("utm_campaign","studios-founding-pilot");
  u.searchParams.set("utm_content",content);
  u.hash="pilot";
  return u.toString();
}

function product(id,name,route,content,summary){
  return Object.freeze({
    id,
    name,
    route,
    summary,
    availability:"founding-pilot",
    ctaLabel:"Request founding access",
    ctaUrl:pilotUrl(content)
  });
}

function freePreview(id,name,route,summary){
  return Object.freeze({
    id,
    name,
    route,
    summary,
    availability:"free-preview",
    ctaLabel:"Try free preview",
    ctaUrl:route
  });
}

export function createStudiosMarketManifest(){
  return Object.freeze({
    schema:"sauceapproved.studio.market-manifest",
    version:1,
    product:"SauceApproved Studios Market",
    publicDiscovery:true,
    pilotApplicationsOpen:true,
    paidCheckoutEnabled:false,
    pricingApprovalRequired:true,
    commercialState:"pre-checkout-founding-pilot",
    checkoutBlockers:Object.freeze([
      "pricing-approval",
      "terms-approval",
      "privacy-approval",
      "payment-path-verification"
    ]),
    products:Object.freeze([
      product(
        "content-multiplier",
        "Content Multiplier",
        "/content-multiplier",
        "studio-content-multiplier",
        "Turn one approved source into governed multi-channel content with brand truth, lineage, opportunity discovery and fatigue protection."
      ),
      product(
        "ai-sales-agent",
        "AI Sales Agent",
        "/ai-sales-agent",
        "studio-ai-sales-agent",
        "Grounded sales intelligence with approved product facts, consent controls, objection intelligence and auditable handoff decisions."
      ),
      product(
        "brand-brain",
        "Brand Brain",
        "/brand-brain",
        "studio-brand-brain",
        "Govern approved brand truth with Constitution rules, cross-channel consistency, impact previews and historical drift comparison."
      ),
      freePreview(
        "vintage-camera",
        "Vintage Camera",
        "/vintage-camera",
        "Shoot or load a clip, compare the untouched source against four original vintage looks, keep the original, and export locally in the browser."
      ),
      product(
        "studios-bundle",
        "Studios Bundle",
        "/market",
        "studio-bundle",
        "Use Brand Brain as the governed source of truth feeding Content Multiplier and AI Sales Agent through one controlled Studio system."
      )
    ])
  });
}
