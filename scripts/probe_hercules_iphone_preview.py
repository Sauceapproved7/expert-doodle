"""Credential-free external smoke evidence for the original Hercules iPhone UI preview.

Never reports live AI or TestFlight readiness. Never follows redirects or
visits any arbitrary address, logs secrets, or makes state-changing requests.
"""
from dataclasses import dataclass
import json
import sys
from urllib import error, request


ORIGIN = "https://hercules-iphone-ui-preview.onrender.com"
PATHS = ("/", "/manifest.webmanifest", "/service-worker.js",
         "/app-icon-192.png", "/app-icon-512.png")
BODY_LIMIT = 1_000_000
TIMEOUT_SECONDS = 15
PNG = b"\x89PNG\r\n\x1a\n"


@dataclass(frozen=True)
class PreviewResponse:
    status: int
    content_type: str
    body: bytes


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def public_get(path):
    if path not in PATHS:
        raise ValueError("unapproved_public_path")
    url = ORIGIN + path
    opener = request.build_opener(NoRedirect)
    req = request.Request(url, method="GET", headers={
        "Accept": "*/*", "User-Agent": "Hercules-iPhone-Preview-Safe-Probe/1.0"
    })
    try:
        with opener.open(req, timeout=TIMEOUT_SECONDS) as res:
            return PreviewResponse(res.status, res.headers.get("Content-Type", ""),
                                   res.read(BODY_LIMIT + 1))
    except error.HTTPError as exc:
        with exc:
            return PreviewResponse(exc.code, exc.headers.get("Content-Type", ""),
                                   exc.read(BODY_LIMIT + 1))


def _assess(path, result):
    if not isinstance(result, PreviewResponse):
        return "unrecognized_response"
    if result.status != 200:
        return f"http_{result.status}"
    if len(result.body) > BODY_LIMIT:
        return "oversized_response"
    mime = result.content_type.lower().split(";", 1)[0].strip()
    if path == "/":
        if mime != "text/html":
            return "unexpected_content_type"
        html = result.body.decode("utf-8", errors="replace")
        if "PREVIEW ONLY" not in html or 'id="chatSend" disabled' not in html:
            return "preview_notice_missing"
        if 'name="robots" content="noindex,nofollow"' not in html:
            return "noindex_missing"
        if "fetch(" in html or "XMLHttpRequest" in html:
            return "preview_network_surface_present"
        return "ok"
    if path == "/manifest.webmanifest":
        if mime not in ("application/manifest+json", "application/json"):
            return "unexpected_content_type"
        try:
            obj = json.loads(result.body)
        except (ValueError, UnicodeDecodeError):
            return "invalid_json"
        if not isinstance(obj, dict):
            return "invalid_manifest"
        icons = obj.get("icons")
        paths = {i.get("src") for i in icons if isinstance(i, dict)} if isinstance(icons, list) else set()
        if "preview" not in str(obj.get("name", "")).lower() or obj.get("display") != "standalone" or obj.get("start_url") != "/" or paths != {"/app-icon-192.png", "/app-icon-512.png"}:
            return "invalid_manifest"
        return "ok"
    if path == "/service-worker.js":
        if mime not in ("application/javascript", "text/javascript", "application/x-javascript"):
            return "unexpected_content_type"
        return "ok" if b"hercules-shell-v2" in result.body else "unreviewed_service_worker"
    if path.startswith("/app-icon"):
        if mime != "image/png" or not result.body.startswith(PNG) or len(result.body) < 24:
            return "invalid_icon"
        expected = 192 if path == "/app-icon-192.png" else 512
        width = int.from_bytes(result.body[16:20], "big")
        height = int.from_bytes(result.body[20:24], "big")
        return "ok" if width == expected and height == expected else "invalid_icon_dimensions"
    return "unapproved_path"


def run_probe(fetcher=public_get):
    results = []
    for path in PATHS:
        try:
            res = fetcher(path)
            reason = _assess(path, res)
            status = res.status if isinstance(res, PreviewResponse) else None
        except (error.URLError, TimeoutError, OSError, ValueError):
            reason, status = "request_unavailable", None
        results.append({"path": path, "http_status": status, "reason": reason,
                        "passed": reason == "ok"})
    ready = all(row["passed"] for row in results)
    return {
        "schema": "hercules.iphone.static-preview-smoke.v1",
        "origin": ORIGIN,
        "status": "preview_assets_verified" if ready else "preview_unverified",
        "static_preview_reachable": ready,
        "ai_operational": False,
        "release_approved": False,
        "checks": results,
    }


def main():
    result = run_probe()
    print(json.dumps(result, indent=2))
    return 0 if result["static_preview_reachable"] else 1


if __name__ == "__main__":
    sys.exit(main())
