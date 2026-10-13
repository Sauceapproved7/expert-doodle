"""Read-only proof that the isolated native Hercules model lab is reachable and protected.

No credentials, dynamic URL inputs, body logging, model prompts or state changes.
Never infer production chatbot capability from this lab's presence.
"""
import json
import sys
from dataclasses import dataclass
from urllib import error, request


ORIGIN = "https://hercules-native-model-plane-lab.onrender.com"
PATHS = ("/health", "/v1/models", "/v1/candidates")
READ_LIMIT = 128 * 1024


@dataclass(frozen=True)
class Response:
    status: int
    content_type: str
    body: bytes


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def public_get(path):
    if path not in PATHS:
        raise ValueError("unapproved_fixed_path")
    opener = request.build_opener(NoRedirect)
    req = request.Request(ORIGIN + path, method="GET", headers={
        "Accept": "application/json", "User-Agent": "Hercules-Lab-ReadOnly-Safety/1.0"
    })
    try:
        with opener.open(req, timeout=75 if path == "/health" else 12) as res:
            return Response(res.status, res.headers.get("Content-Type", ""), res.read(READ_LIMIT + 1))
    except error.HTTPError as exc:
        with exc:
            return Response(exc.code, exc.headers.get("Content-Type", ""), exc.read(READ_LIMIT + 1))


def assess(path, response):
    if not isinstance(response, Response):
        return "invalid_response"
    if len(response.body) > READ_LIMIT:
        return "oversized_response"
    mime = response.content_type.lower().split(";", 1)[0].strip()
    if path in ("/v1/models", "/v1/candidates"):
        # Every unauthenticated attempt must be rejected; even an unexpected
        # 403/404 means this endpoint's expected authority boundary is unproven.
        return "ok" if response.status == 401 else "protected_route_exposed" if response.status == 200 else "unauthorized_boundary_unverified"
    if response.status != 200:
        return "http_" + str(response.status)
    if mime != "application/json":
        return "invalid_content_type"
    try:
        payload = json.loads(response.body)
    except (ValueError, UnicodeDecodeError):
        return "invalid_json"
    if not isinstance(payload, dict) or payload.get("ok") is not True or payload.get("service") != "hercules-model-plane":
        return "wrong_service"
    if payload.get("candidateEvaluationEnabled") is not False or payload.get("candidateRuntimes") != 0:
        return "candidate_evaluation_enabled"
    values = (payload.get("models"), payload.get("active"), payload.get("embeddedRuntimes"))
    if any(type(value) is not int or value != 8 for value in values):
        return "runtime_count_mismatch"
    return "ok"


def evaluate_probe(fetcher=public_get):
    checks = []
    for path in PATHS:
        try:
            res = fetcher(path)
            reason = assess(path, res)
            status = res.status if isinstance(res, Response) else None
        except (error.URLError, TimeoutError, OSError, ValueError):
            reason, status = "request_unavailable", None
        checks.append({"path": path, "http_status": status, "reason": reason, "passed": reason == "ok"})
    passed = all(check["passed"] for check in checks)
    return {
        "schema": "hercules.native-model-lab.public-boundary.v1",
        "origin": ORIGIN,
        "status": "native_lab_boundary_verified" if passed else "native_lab_unverified",
        "native_model_lab_checked": passed,
        "chat_inference_verified": False,
        "production_connected": False,
        "public_release_approved": False,
        "checks": checks,
    }


def main():
    result = evaluate_probe()
    print(json.dumps(result, indent=2))
    return 0 if result["native_model_lab_checked"] else 1


if __name__ == "__main__":
    sys.exit(main())
