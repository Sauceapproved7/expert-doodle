"""Deterministic, offline tests for the public-only Hercules iPhone release probe."""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import hercules_iphone_launch_probe as probe


def responses(model_count=1, sw_version="v2"):
    def data(body, mime):
        return probe.ProbeResponse(200, mime, body)
    manifest = {"name": "Hercules", "short_name": "Hercules", "display": "standalone",
                "start_url": "/", "scope": "/",
                "icons": [{"src": "/app-icon-192.png"}, {"src": "/app-icon-512.png"}]}
    return {
        "/": data(b'<title>HERCULES // COMMAND CENTER</title><link rel="manifest" href="/manifest.webmanifest"><script src="/service-worker.js"></script>', "text/html"),
        "/manifest.webmanifest": data(json.dumps(manifest).encode(), "application/manifest+json"),
        "/service-worker.js": data(('const CACHE="hercules-shell-' + sw_version + '";').encode(), "application/javascript"),
        "/app-icon-192.png": data(b"\x89PNG\r\n\x1a\n" + b"x" * 20, "image/png"),
        "/app-icon-512.png": data(b"\x89PNG\r\n\x1a\n" + b"x" * 20, "image/png"),
        "/health": data(b'{"ok":true,"service":"hercules-ai"}', "application/json"),
        "/v1/models": data(json.dumps({"count": model_count, "installed": [{"name": "eligible"}] if model_count else []}).encode(), "application/json"),
    }


class IphoneLaunchProbeTests(unittest.TestCase):
    def test_positive_probe_only_certifies_network_surface_not_launch(self):
        result = probe.run_probe(lambda path: responses()[path])
        self.assertTrue(result["network_surface_ready"])
        self.assertEqual(result["status"], "public_probe_passed")
        self.assertFalse(result["full_release_certified"])
        self.assertFalse(result["marketing_authorized"])
        self.assertEqual([x["path"] for x in result["checks"]], list(probe.PATHS))

    def test_stale_public_service_worker_blocks_promotion(self):
        result = probe.run_probe(lambda path: responses(sw_version="v1")[path])
        self.assertFalse(result["network_surface_ready"])
        self.assertIn("service_worker_version_unverified", [x["reason"] for x in result["checks"]])

    def test_healthy_process_without_model_does_not_pass(self):
        result = probe.run_probe(lambda path: responses(model_count=0)[path])
        self.assertFalse(result["network_surface_ready"])
        self.assertIn("no_eligible_model", [x["reason"] for x in result["checks"]])

    def test_model_backend_502_is_blocker_not_offline_ready(self):
        inventory = responses()
        inventory["/v1/models"] = probe.ProbeResponse(502, "application/json", b'{"detail":"not ready"}')
        result = probe.run_probe(lambda path: inventory[path])
        self.assertFalse(result["network_surface_ready"])
        self.assertIn("http_502", [x["reason"] for x in result["checks"]])

    def test_html_api_fallback_is_not_accepted_as_json(self):
        inventory = responses()
        inventory["/v1/models"] = probe.ProbeResponse(200, "text/html", b"<html>fallback</html>")
        result = probe.run_probe(lambda path: inventory[path])
        self.assertIn("unexpected_content_type", [x["reason"] for x in result["checks"]])

    def test_redirect_and_timeout_fail_closed_and_only_expose_fixed_paths(self):
        inventory = responses()
        inventory["/manifest.webmanifest"] = probe.ProbeResponse(302, "text/html", b"")
        def get(path):
            if path == "/health":
                raise TimeoutError("private server details should not leak")
            return inventory[path]
        result = probe.run_probe(get)
        self.assertFalse(result["network_surface_ready"])
        self.assertIn("request_unavailable", [x["reason"] for x in result["checks"]])
        self.assertNotIn("private server details", json.dumps(result))
        self.assertEqual(set(x["path"] for x in result["checks"]), set(probe.PATHS))

    def test_oversized_body_is_rejected(self):
        inventory = responses()
        inventory["/health"] = probe.ProbeResponse(200, "application/json", b"x" * (probe.BODY_LIMIT + 1))
        result = probe.run_probe(lambda path: inventory[path])
        self.assertIn("body_too_large", [x["reason"] for x in result["checks"]])

    def test_only_predeclared_https_host_and_no_redirects(self):
        self.assertEqual(probe.BASE_URL, "https://hercules-mcp.onrender.com")
        self.assertIsNone(probe.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.example"))
        for path in probe.PATHS:
            self.assertTrue(path.startswith("/"))
            self.assertNotIn("?", path)


if __name__ == "__main__":
    unittest.main()
