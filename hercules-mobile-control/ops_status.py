"""Bounded, public-only reachability checks for the Hercules mobile staging console.

No SSH, credentials, Render API token, provider configuration, or arbitrary URLs.
An HTTP response is evidence of reachability, NOT proof of launch readiness.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Lock
from time import monotonic
from urllib import error, request

TARGETS = (
    {"id": "browser", "name": "Hercules Browser", "url": "https://hercules-browser-standalone.onrender.com", "dashboard": "https://dashboard.render.com/web/srv-daskfp8u01pc73cbvj0g"},
    {"id": "mcp", "name": "Hercules MCP", "url": "https://hercules-mcp.onrender.com", "dashboard": "https://dashboard.render.com/web/srv-db0sic6gekts73b40jcg"},
    {"id": "smallz", "name": "Smallz", "url": "https://smallz-hercules.onrender.com", "dashboard": "https://dashboard.render.com/web/srv-db08fglg1s2s73d0o2rg"},
    {"id": "studio", "name": "Hercules Studio", "url": "https://sauceapproved-studio.onrender.com", "dashboard": "https://dashboard.render.com/web/srv-dat51nbtqb8s73buk8e0"},
    {"id": "guard", "name": "Domain Guard", "url": "https://hercules-domain-guard.onrender.com", "dashboard": "https://dashboard.render.com/web/srv-db5alfh42hec7389p12g"},
)

CACHE_SECONDS = 60
TIMEOUT_SECONDS = 3
_lock = Lock()
_cache = None
_cached_at = 0.0

class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

_opener = request.build_opener(NoRedirect)

def _request_code(url):
    """Return HTTP status, including HTTPError cases; never follow redirects."""
    req = request.Request(url, method="GET", headers={"User-Agent": "Hercules-Mobile-ReadOnly/1.0", "Accept": "*/*"})
    try:
        with _opener.open(req, timeout=TIMEOUT_SECONDS) as response:
            return response.status
    except error.HTTPError as exc:
        return exc.code

def probe(target, http_code=_request_code):
    """Check only predeclared addresses; never load response bodies."""
    base = target["url"]
    try:
        code = http_code(base + "/health")
        checked_path = "/health"
        if code == 404:
            code = http_code(base + "/")
            checked_path = "/"
    except (error.URLError, TimeoutError, OSError, ValueError):
        return {**target, "state": "unconfirmed", "http_code": None, "detail": "No timely HTTP response (free instances may be waking)"}
    if 200 <= code < 300 and checked_path == "/health":
        state, detail = "healthy", "Health endpoint responded"
    elif 200 <= code < 400:
        state, detail = "responding", "HTTP response received; application health not verified"
    elif code in (401, 403):
        state, detail = "protected", "HTTP endpoint requires authorization"
    elif code == 429:
        state, detail = "limited", "Endpoint rate-limited the request"
    elif code >= 500:
        state, detail = "degraded", "Server returned an error"
    else:
        state, detail = "unconfirmed", "Endpoint not found or unavailable"
    return {**target, "state": state, "http_code": code, "detail": detail}

def get_snapshot():
    global _cache, _cached_at
    with _lock:
        if _cache is not None and monotonic() - _cached_at < CACHE_SECONDS:
            return _cache
        with ThreadPoolExecutor(max_workers=len(TARGETS)) as pool:
            services = list(pool.map(probe, TARGETS))
        snapshot = {
            "source": "bounded_public_http",
            "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "cache_seconds": CACHE_SECONDS,
            "services": services,
            "note": "HTTP reachability only. Does not verify payments, SSH, task execution, live deployment status, or production readiness.",
        }
        _cache, _cached_at = snapshot, monotonic()
        return snapshot
