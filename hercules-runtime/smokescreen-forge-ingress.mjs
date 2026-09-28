import {createHash,createHmac} from "node:crypto";

const DEFAULT_WINDOW_MS=60_000;
const DEFAULT_MAX_CLIENTS=4096;
const MAX_EVENTS_PER_CLIENT=512;
const PRIVILEGED_PATH=/(?:^|\/)(?:admin|operator|audit|publish|rollback|control|security)(?:\/|$)/i;

function hashIdentity(value){
  return createHash("sha256").update(String(value)).digest("hex").slice(0,32);
}

function boundedPathname(value){
  const pathname=String(value??"/").slice(0,2048);
  return pathname.startsWith("/")?pathname:"/"+pathname;
}

function normalizeNow(now){
  const value=Number(now());
  if(!Number.isFinite(value))throw new Error("invalid clock");
  return value;
}

function trimWindow(events,cutoff){
  while(events.length&&events[0].at<cutoff)events.shift();
  if(events.length>MAX_EVENTS_PER_CLIENT){
    events.splice(0,events.length-MAX_EVENTS_PER_CLIENT);
  }
}

function freezeResult(result){
  return Object.freeze({
    ...result,
    decision:Object.freeze({...result.decision}),
  });
}

export function deriveForgeSmokeScreenKey(controlToken){
  const token=String(controlToken??"");
  if(Buffer.byteLength(token)<32){
    throw new Error("control token must be at least 32 bytes for SmokeScreen key derivation");
  }
  return createHmac("sha256",Buffer.from(token,"utf8"))
    .update("hercules.smokescreen.forge.observe.v1")
    .digest();
}

export function createForgeSmokeScreenObserver({
  agent,
  mode="OBSERVE_ONLY",
  now=Date.now,
  windowMs=DEFAULT_WINDOW_MS,
  maxClients=DEFAULT_MAX_CLIENTS,
  onDecision=async()=>{},
}={}){
  if(!agent||typeof agent.observe!=="function"||typeof agent.checkpoint!=="function"){
    throw new Error("SmokeScreen agent with observe() and checkpoint() required");
  }
  if(mode!=="OBSERVE_ONLY"){
    throw new Error("Forge ingress currently supports OBSERVE_ONLY mode");
  }
  if(typeof onDecision!=="function")throw new Error("onDecision must be a function");
  if(!Number.isInteger(windowMs)||windowMs<1000||windowMs>60*60*1000){
    throw new Error("windowMs must be an integer from 1000 to 3600000");
  }
  if(!Number.isInteger(maxClients)||maxClients<16||maxClients>100_000){
    throw new Error("maxClients must be an integer from 16 to 100000");
  }

  const clients=new Map();
  const totals={OBSERVE:0,THROTTLE:0,QUARANTINE:0,CONTAIN:0};
  let observed=0;
  let lastDecisionAt=null;

  function clientState(fingerprint,at){
    let state=clients.get(fingerprint);
    if(!state){
      if(clients.size>=maxClients){
        const oldest=[...clients.entries()].sort((a,b)=>a[1].lastSeen-b[1].lastSeen)[0]?.[0];
        if(oldest)clients.delete(oldest);
      }
      state={events:[],lastSeen:at};
      clients.set(fingerprint,state);
    }
    state.lastSeen=at;
    return state;
  }

  async function observe(input={}){
    const at=normalizeNow(now);
    const pathname=boundedPathname(input.pathname);
    const identity=[
      input.sessionId||"",
      input.remoteAddress||"",
      input.userAgent||"",
    ].join("|");
    const clientFingerprint=hashIdentity(identity||"anonymous");
    const state=clientState(clientFingerprint,at);
    const statusCode=Number(input.statusCode)||0;
    const authFailure=statusCode===401||statusCode===403;
    const privileged=PRIVILEGED_PATH.test(pathname);
    const routeProbe=statusCode===404||(authFailure&&privileged);
    const signatureMismatch=statusCode===401&&input.hasAuthorizationHeader===true;

    state.events.push({
      at,
      pathnameHash:hashIdentity(pathname),
      authFailure,
      routeProbe,
      signatureMismatch,
      privileged,
    });
    trimWindow(state.events,at-windowMs);

    const events=state.events;
    const authFailures=events.filter((item)=>item.authFailure).length;
    const routeProbes=events.filter((item)=>item.routeProbe).length;
    const signatureMismatches=events.filter((item)=>item.signatureMismatch).length;
    const distinctPaths=new Set(events.map((item)=>item.pathnameHash)).size;
    const enumerationPattern=distinctPaths>=5||routeProbes>=8;
    const privilegeBoundaryProbe=events.some((item)=>item.privileged&&item.authFailure);

    const decision=agent.observe({
      sessionId:clientFingerprint,
      route:pathname,
      signals:{
        authFailures,
        routeProbes,
        requestVelocity:events.length,
        signatureMismatches,
        enumerationPattern,
        honeytokenTouched:false,
        credentialStuffing:authFailures>=12,
        impossibleSequence:false,
        privilegeBoundaryProbe,
      },
    });

    observed+=1;
    totals[decision.disposition]=(totals[decision.disposition]??0)+1;
    lastDecisionAt=new Date(at).toISOString();

    const result=freezeResult({
      schema:"hercules.smokescreen.forge-observation.v1",
      mode,
      enforcementApplied:false,
      wouldRouteMode:decision.routeMode,
      outboundCounterattack:false,
      clientFingerprint,
      decision,
    });
    await onDecision(result);
    return result;
  }

  return Object.freeze({
    observe,
    publicStatus(){
      return Object.freeze({
        enabled:true,
        mode,
        enforcement:false,
      });
    },
    snapshot(){
      return Object.freeze({
        schema:"hercules.smokescreen.forge-observe-summary.v1",
        mode,
        enforcementApplied:false,
        outboundCounterattack:false,
        observed,
        activeClients:clients.size,
        dispositions:Object.freeze({...totals}),
        lastDecisionAt,
        auditCheckpoint:agent.checkpoint(),
      });
    },
  });
}
