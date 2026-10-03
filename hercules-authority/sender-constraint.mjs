const SENSITIVE=/^(authorization|cookie|set-cookie|access.?token|refresh.?token|id.?token|api.?key|private.?key|client.?secret|password|secret|credentials?)$/i;

function strings(value){return Array.isArray(value)?value.map(String):[];}
function deny(...codes){return Object.freeze({ok:false,reasonCodes:[...new Set(codes)].sort()});}
export function createReplayCache(){
  const seen=new Set();
  return Object.freeze({
    consume(id){
      const key=String(id??"").trim();
      if(!key||seen.has(key)) return false;
      seen.add(key); return true;
    }
  });
}
export function evaluateSenderConstraint(input={}){
  const {token,proof}=input;
  if(!token||!proof) return deny("TOKEN_OR_PROOF_MISSING");
  if(token.issuer!==input.expectedIssuer) return deny("TOKEN_ISSUER_MISMATCH");
  if(token.audience!==input.expectedAudience) return deny("TOKEN_AUDIENCE_MISMATCH");
  const now=Date.parse(input.now), exp=Date.parse(token.expiresAt), proofAt=Date.parse(proof.issuedAt);
  if(!Number.isFinite(now)||!Number.isFinite(exp)||!Number.isFinite(proofAt)) return deny("INVALID_TIMESTAMP");
  if(now>=exp) return deny("TOKEN_EXPIRED");
  const missing=strings(input.requiredScopes).filter(scope=>!strings(token.scopes).includes(scope));
  if(missing.length) return deny("TOKEN_SCOPE_INSUFFICIENT");
  if(!token.keyThumbprint||proof.keyThumbprint!==token.keyThumbprint) return deny("PROOF_KEY_BINDING_MISMATCH");
  if(String(proof.method).toUpperCase()!==String(input.method).toUpperCase()) return deny("PROOF_METHOD_MISMATCH");
  if(proof.uri!==input.uri) return deny("PROOF_URI_MISMATCH");
  if(Math.abs(now-proofAt)>300000) return deny("PROOF_STALE");
  if(!input.replayCache?.consume(proof.id)) return deny("PROOF_REPLAY");
  return Object.freeze({ok:true,tenantId:token.tenantId,reasonCodes:["SENDER_CONSTRAINT_VALID"]});
}
export function redactSecurityEvent(value={}){
  return Object.freeze(Object.fromEntries(Object.entries(value).filter(([key])=>!SENSITIVE.test(key))));
}
