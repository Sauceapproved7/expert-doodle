"""Read-only, no-secret public iPhone shell and model inventory evidence.

This does not verify iPhone device behavior, deployment SHA, buyer access, or
authorize any release. It cannot modify deployment, accounts or marketing.
"""
import json
import sys
from dataclasses import dataclass
from urllib import error, request

BASE_URL = "https://hercules-mcp.onrender.com"
PATHS = (
    "/", "/manifest.webmanifest", "/service-worker.js",
    "/app-icon-192.png", "/app-icon-512.png", "/health", "/v1/models",
)
BODY_LIMIT = 1024 * 1024
TIMEOUT_SECONDS = 8
# One fixed read-only warm-up for free instances; every verification request
# still checks its own response. The 3-minute CI job remains bounded.
WARMUP_TIMEOUT_SECONDS = 75
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


@dataclass(frozen=True)
class ProbeResponse:
    status: int
    content_type: str
    body: bytes


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def public_get(path, *, timeout=TIMEOUT_SECONDS):
    """Fetch a pinned, uncredentialed HTTPS origin; never follow redirects."""
    if path not in PATHS:
        raise ValueError("unapproved_path")
    opener = request.build_opener(NoRedirect)
    req = request.Request(
        BASE_URL + path,
        method="GET",
        headers={"User-Agent": "Hercules-iPhone-Release-Evidence/1.0", "Accept": "*/*"},
    )
    try:
        with opener.open(req, timeout=timeout) as response:
            return ProbeResponse(response.status, response.headers.get("Content-Type", ""), response.read(BODY_LIMIT + 1))
    except error.HTTPError as exc:
        with exc:
            return ProbeResponse(exc.code, exc.headers.get("Content-Type", ""), exc.read(BODY_LIMIT + 1))


def public_warmup():
    """Wake the pinned public service once; readiness is evaluated separately."""
    return public_get("/health", timeout=WARMUP_TIMEOUT_SECONDS)


def _json(response):
    try:
        data = json.loads(response.body)
    except (ValueError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def _assess(path, response):
    if not isinstance(response, ProbeResponse):
        return "unrecognized_response"
    if len(response.body) > BODY_LIMIT:
        return "body_too_large"
    if response.status != 200:
        return f"http_{response.status}"
    mime = response.content_type.lower().split(";", 1)[0].strip()
    if path in ("/health", "/v1/models"):
        if mime != "application/json":
            return "unexpected_content_type"
        payload = _json(response)
        if payload is None:
            return "invalid_json"
        if path == "/health":
            return "ok" if payload.get("ok") is True and payload.get("service") == "hercules-ai" else "health_identity_mismatch"
        count = payload.get("count")
        installed = payload.get("installed")
        if not isinstance(count, int) or isinstance(count, bool) or count < 1:
            return "no_eligible_model"
        if not isinstance(installed, list) or not installed or not any(isinstance(m, dict) and isinstance(m.get("name"), str) and m["name"].strip() for m in installed):
            return "no_eligible_model"
        return "ok"
    if path == "/":
        if mime != "text/html":
            return "unexpected_content_type"
        html = response.body.decode("utf-8", errors="replace")
        return "ok" if "HERCULES" in html and 'href="/manifest.webmanifest"' in html and "/service-worker.js" in html else "missing_installable_shell"
    if path == "/manifest.webmanifest":
        if mime not in ("application/manifest+json", "application/json"):
            return "unexpected_content_type"
        manifest = _json(response)
        if manifest is None:
            return "invalid_json"
        icons = manifest.get("icons")
        icon_paths = {i.get("src") for i in icons if isinstance(i, dict) and isinstance(i.get("src"), str)} if isinstance(icons, list) else set()
        return "ok" if manifest.get("name") == "Hercules" and manifest.get("display") == "standalone" and manifest.get("start_url") == "/" and {"/app-icon-192.png", "/app-icon-512.png"}.issubset(icon_paths) else "invalid_installable_manifest"
    if path == "/service-worker.js":
        if mime not in ("application/javascript", "text/javascript", "application/x-javascript"):
            return "unexpected_content_type"
        return "ok" if b"hercules-shell-v2" in response.body else "service_worker_version_unverified"
    if path in ("/app-icon-192.png", "/app-icon-512.png"):
        return "ok" if mime == "image/png" and response.body.startswith(PNG_SIGNATURE) else "invalid_png_icon"
    return "unapproved_path"


def run_probe(fetcher=public_get, *, wake=None):
    # Do not count warm-up as a successful check. A cold-start timeout must not
    # bypass any of the fixed seven public readiness checks.
    if wake is not None:
        try:
            wake()
        except (error.URLError, TimeoutError, OSError, ValueError):
            pass
    checks = []
    for path in PATHS:
        try:
            response = fetcher(path)
            reason = _assess(path, response)
            status = response.status if isinstance(response, ProbeResponse) else None
        except (error.URLError, TimeoutError, OSError, ValueError):
            reason, status = "request_unavailable", None
        checks.append({"path": path, "http_status": status, "reason": reason, "passed": reason == "ok"})
    good = all(check["passed"] for check in checks)
    return {
        "schema": "hercules.iphone.public-readiness-evidence.v1",
        "origin": BASE_URL,
        "status": "public_probe_passed" if good else "public_probe_blocked",
        "network_surface_ready": good,
        "full_release_certified": False,
        "marketing_authorized": False,
        "checks": checks,
    }


def main():
    result = run_probe(wake=public_warmup)
    print(json.dumps(result, indent=2))
    return 0 if result["network_surface_ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
