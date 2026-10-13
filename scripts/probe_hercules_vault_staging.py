"""Credential-free independent HTTPS access-boundary check for Hercules Vault staging.

Exactly two fixed-origin requests. Never accepts caller-supplied URLs, private
data, tokens or shell commands. A public 401 on the query surface is success.
"""
from dataclasses import dataclass
from urllib import request, error
import json
import sys

ORIGIN="https://hercules-vault-staging.onrender.com"
BODY_LIMIT=32_768
ROUTES=(("/health","GET"),("/v1/vault/ask","POST"))

@dataclass(frozen=True)
class HttpResult:
    status:int
    content_type:str
    body:bytes

class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None

def public_get(path,method):
    if (path,method) not in ROUTES:
        raise ValueError("unauthorized_probe_path")
    data=None
    headers={"accept":"application/json","user-agent":"Hercules-Vault-Isolated-Staging-Safety/1.0"}
    if method=="POST":
        data=b'{"query":"What does Hercules model readiness verify?"}'
        headers["content-type"]="application/json"
    req=request.Request(ORIGIN+path,data=data,headers=headers,method=method)
    opener=request.build_opener(NoRedirect)
    try:
        with opener.open(req,timeout=75 if path=="/health" else 14) as resp:
            return HttpResult(resp.status,resp.headers.get("Content-Type",""),resp.read(BODY_LIMIT+1))
    except error.HTTPError as exc:
        with exc:
            return HttpResult(exc.code,exc.headers.get("Content-Type",""),exc.read(BODY_LIMIT+1))

def evaluate(path, result):
    if not isinstance(result,HttpResult):
        return "invalid_response"
    if len(result.body)>BODY_LIMIT:
        return "oversized_response"
    if path=="/v1/vault/ask":
        if result.status==200:
            return "unauthenticated_query_exposed"
        if result.status!=401:
            return "anonymous_boundary_unverified"
        # Do not expose returned provider details or rely on a 401 alone for
        # overall readiness; also demand a healthy, correctly gated service.
        return "ok"
    if result.status!=200:
        return "http_"+str(result.status)
    if result.content_type.lower().split(";",1)[0].strip()!="application/json":
        return "invalid_content_type"
    try:
        data=json.loads(result.body)
    except (ValueError,UnicodeDecodeError):
        return "invalid_json"
    if not isinstance(data,dict) or data.get("ok") is not True or \
       data.get("service")!="hercules-vault-source-assistant" or \
       data.get("experimental") is not True or \
       data.get("general_chat_verified") is not False or \
       data.get("public_release_approved") is not False:
        return "incorrect_service_or_gate"
    return "ok"

def check_staging(fetch=public_get):
    checks=[]
    for path,method in ROUTES:
        try:
            response=fetch(path,method)
            reason=evaluate(path,response)
            status=response.status if isinstance(response,HttpResult) else None
        except (error.URLError,TimeoutError,OSError,ValueError):
            reason,status="request_unavailable",None
        checks.append({"path":path,"method":method,"http_status":status,
                       "reason":reason,"passed":reason=="ok"})
    ok=all(x["passed"] for x in checks)
    return {"schema":"hercules.vault.staging-boundary.v1",
            "origin":ORIGIN,
            "status":"isolated_staging_public_boundary_verified" if ok else "staging_unverified",
            "staging_boundary_verified":ok,
            "authenticated_retrieval_verified_externally":False,
            "public_release_approved":False,
            "checks":checks}

if __name__=="__main__":
    result=check_staging()
    print(json.dumps(result,indent=2))
    sys.exit(0 if result["staging_boundary_verified"] else 1)
