import {createHmac} from "node:crypto";
import {createSmokeScreenDecision} from "./smokescreen-agent.mjs";

const MAX_PATH=512;
const MAX_METHOD=16;
const TRUSTED_CONTEXT_KEYS=new Set([
  "failedAuthAttempts",
  "routeProbes",
  "requestBurst",
  "enumerationPattern",
  "privilegeBoundaryProbe",
  "honeytokenTouched",
  "knownMaliciousIndicator",
]);

function keyBytes(value){
  const bytes=Buffer.isBuffer(value)?value:Buffer.from(String(value??""),"utf8");
  if(bytes.length<32)throw new Error("hmacKey must be at least 32 bytes");
  return bytes;
}
function boundedInt(value,max){
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0)return 0;
  return Math.min(max,Math.trunc(n));
}
function safePath(raw){
  try{
    const url=new URL(String(raw??"/"),"http://hercules.observe.local");
    const path=url.pathname.slice(0,MAX_PATH);
    return path.startsWith("/")?path:"/";
  }catch{
    return "/";
  }
}
function methodOf(value){
  const method=String(value??"GET").toUpperCase().replace(/[^A-Z]/g,"").slice(0,MAX_METHOD);
  return method||"GET";
}
function firstForwardedIp(headers={}){
  const raw=String(headers["x-forwarded-for"]??headers["X-Forwarded-For"]??"");
  return raw.split(",")[0].trim().slice(0,128);
}
function fingerprint(key,value){
  if(!value)return "unknown";
  return createHmac("sha256",key).update("smokescreen-observe-ip\0"+value).digest("hex").slice(0,24);
}
function trustedContext(input={}){
  const raw=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  return Object.fromEntries([...TRUSTED_CONTEXT_KEYS].map(k=>[k,raw[k]]));
}

export function deriveObserveSignals(request={},options={}){
  const key=keyBytes(options.hmacKey);
  const context=trustedContext(request.context);
  return Object.freeze({
    failedAuthAttempts:boundedInt(context.failedAuthAttempts,50),
    routeProbes:boundedInt(context.routeProbes,100),
    requestBurst:boundedInt(context.requestBurst,1000),
    enumerationPattern:context.enumerationPattern===true,
    privilegeBoundaryProbe:context.privilegeBoundaryProbe===true,
    honeytokenTouched:context.honeytokenTouched===true,
    knownMaliciousIndicator:context.knownMaliciousIndicator===true,
    clientFingerprint:fingerprint(key,firstForwardedIp(request.headers)),
  });
}

export function createObserveOnlyIngressAdapter(options={}){
  const key=keyBytes(options.hmacKey);
  const now=typeof options.now==="function"?options.now:Date.now;

  return Object.freeze({
    mode:"OBSERVE_ONLY",
    enforcementEnabled:false,

    observe(request={}){
      const route=safePath(request.url);
      const signals=deriveObserveSignals(request,{hmacKey:key});
      const decision=createSmokeScreenDecision({
        sessionId:signals.clientFingerprint==="unknown"?"observe-anonymous":signals.clientFingerprint,
        route,
        signals:{
          failedAuthAttempts:signals.failedAuthAttempts,
          routeProbes:signals.routeProbes,
          requestBurst:signals.requestBurst,
          enumerationPattern:signals.enumerationPattern,
          privilegeBoundaryProbe:signals.privilegeBoundaryProbe,
          honeytokenTouched:signals.honeytokenTouched,
          knownMaliciousIndicator:signals.knownMaliciousIndicator,
        },
      },{hmacKey:key});

      return Object.freeze({
        schema:"hercules.smokescreen.ingress-observation.v1",
        observedAt:new Date(Number(now())).toISOString(),
        mode:"OBSERVE_ONLY",
        enforcementEnabled:false,
        routeMutationAllowed:false,
        blockingAllowed:false,
        delayAllowed:false,
        originalMethod:methodOf(request.method),
        originalRoute:route,
        clientFingerprint:signals.clientFingerprint,
        score:decision.score,
        severity:decision.severity,
        decision:Object.freeze({
          routeMode:decision.routeMode,
          friction:decision.friction,
          alert:decision.alert,
          scope:decision.scope,
          outboundCounterattack:false,
        }),
      });
    },
  });
}
