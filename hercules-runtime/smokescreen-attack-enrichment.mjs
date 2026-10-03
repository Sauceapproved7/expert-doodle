const CATALOG_REVIEWED_AT="2026-09-28";

const TECHNIQUES=Object.freeze({
  "T1110.004":Object.freeze({
    id:"T1110.004",
    name:"Credential Stuffing",
    tactic:"Credential Access",
    source:"https://attack.mitre.org/techniques/T1110/004/",
  }),
  "T1110.001":Object.freeze({
    id:"T1110.001",
    name:"Password Guessing",
    tactic:"Credential Access",
    source:"https://attack.mitre.org/techniques/T1110/001/",
  }),
  "T1595.003":Object.freeze({
    id:"T1595.003",
    name:"Wordlist Scanning",
    tactic:"Reconnaissance",
    source:"https://attack.mitre.org/techniques/T1595/003/",
  }),
  "T1087":Object.freeze({
    id:"T1087",
    name:"Account Discovery",
    tactic:"Discovery",
    source:"https://attack.mitre.org/techniques/T1087/",
  }),
  "T1190":Object.freeze({
    id:"T1190",
    name:"Exploit Public-Facing Application",
    tactic:"Initial Access",
    source:"https://attack.mitre.org/techniques/T1190/",
  }),
});

const IDENTITY_ROUTE=/(?:^|\/)(?:login|signin|auth|account|accounts|user|users|identity|member|members)(?:\/|$)/i;
const PRIVILEGED_ROUTE=/(?:^|\/)(?:admin|operator|control|security|root|audit|publish)(?:\/|$)/i;
const API_ROUTE=/(?:^|\/)(?:api|v\d+)(?:\/|$)/i;

function boundedRoute(value){
  const route=String(value??"/").slice(0,2048);
  return route.startsWith("/")?route:"/"+route;
}

function routeCategory(route){
  if(IDENTITY_ROUTE.test(route))return "identity";
  if(PRIVILEGED_ROUTE.test(route))return "privileged";
  if(API_ROUTE.test(route))return "api";
  return "generic";
}

function numberSignal(signals,key){
  const value=Number(signals?.[key]??0);
  return Number.isFinite(value)&&value>0?Math.floor(value):0;
}

function booleanSignal(signals,key){
  return signals?.[key]===true;
}

function candidate(id,{confidence,basis,evidence,needsCorroboration}){
  const technique=TECHNIQUES[id];
  return Object.freeze({
    ...technique,
    confidence,
    basis,
    evidence:Object.freeze([...evidence]),
    needsCorroboration,
    responseAuthority:"NONE",
  });
}

function freezeEnrichment(value){
  return Object.freeze({
    ...value,
    techniques:Object.freeze([...value.techniques]),
    excludedInferences:Object.freeze([...value.excludedInferences]),
  });
}

export function createAttackEnrichment({route="/",signals={}}={}){
  const bounded=boundedRoute(route);
  const category=routeCategory(bounded);
  const authFailures=numberSignal(signals,"authFailures");
  const routeProbes=numberSignal(signals,"routeProbes");
  const signatureMismatches=numberSignal(signals,"signatureMismatches");
  const enumerationPattern=booleanSignal(signals,"enumerationPattern");
  const credentialStuffing=booleanSignal(signals,"credentialStuffing");
  const privilegeBoundaryProbe=booleanSignal(signals,"privilegeBoundaryProbe");

  const techniques=[];

  if(credentialStuffing){
    techniques.push(candidate("T1110.004",{
      confidence:"HIGH",
      basis:"DIRECT_SIGNAL",
      evidence:["credentialStuffing"],
      needsCorroboration:false,
    }));
  }else if(authFailures>=5){
    techniques.push(candidate("T1110.001",{
      confidence:"MEDIUM",
      basis:"HEURISTIC",
      evidence:["repeatedAuthFailures"],
      needsCorroboration:true,
    }));
  }

  if(routeProbes>=8||enumerationPattern){
    techniques.push(candidate("T1595.003",{
      confidence:routeProbes>=8&&enumerationPattern?"HIGH":"MEDIUM",
      basis:"HEURISTIC",
      evidence:[
        ...(routeProbes>=8?["repeatedRouteProbes"]:[]),
        ...(enumerationPattern?["enumerationPattern"]:[]),
      ],
      needsCorroboration:true,
    }));
  }

  if(category==="identity"&&enumerationPattern){
    techniques.push(candidate("T1087",{
      confidence:"MEDIUM",
      basis:"HEURISTIC",
      evidence:["identityRouteCategory","enumerationPattern"],
      needsCorroboration:true,
    }));
  }

  if(signatureMismatches>=2&&privilegeBoundaryProbe){
    techniques.push(candidate("T1190",{
      confidence:"LOW",
      basis:"HEURISTIC",
      evidence:["repeatedSignatureMismatches","privilegeBoundaryProbe"],
      needsCorroboration:true,
    }));
  }

  techniques.sort((a,b)=>a.id.localeCompare(b.id));

  return freezeEnrichment({
    schema:"hercules.smokescreen.attack-enrichment.v1",
    framework:"MITRE ATT&CK Enterprise",
    catalogReviewedAt:CATALOG_REVIEWED_AT,
    scope:"CANDIDATE_BEHAVIOR_MAPPING_ONLY",
    routeCategory:category,
    techniques,
    excludedInferences:[
      "T1046_NETWORK_SERVICE_DISCOVERY_WITHOUT_NETWORK_SERVICE_TELEMETRY",
      "T1078_VALID_ACCOUNTS_WITHOUT_SUCCESSFUL_ACCOUNT_USE_EVIDENCE",
      "THREAT_ACTOR_ATTRIBUTION",
      "CAMPAIGN_ATTRIBUTION",
    ],
    actorAttribution:false,
    campaignAttribution:false,
    automaticResponseAuthority:false,
    outboundCounterattack:false,
  });
}

export const SMOKESCREEN_ATTACK_CATALOG=Object.freeze({
  reviewedAt:CATALOG_REVIEWED_AT,
  authority:"MITRE ATT&CK Enterprise",
  techniques:Object.freeze(Object.values(TECHNIQUES)),
  directSignalMappings:Object.freeze(["T1110.004"]),
  heuristicMappings:Object.freeze(["T1110.001","T1595.003","T1087","T1190"]),
  explicitlyUnsupportedInferences:Object.freeze(["T1046","T1078"]),
});
