"""Offline tests for the independent Hercules iPhone static preview smoke check."""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import probe_hercules_iphone_preview as probe


def response(content, media_type="text/html", status=200):
    return probe.PreviewResponse(status=status, content_type=media_type, body=content)


def demo(path):
    if path == "/":
        return response(b'<meta name="robots" content="noindex,nofollow"><div>PREVIEW ONLY</div><button id="chatSend" disabled>RUN HERCULES</button><p>No AI model is connected</p>')
    if path == "/manifest.webmanifest":
        return response(json.dumps({
            "name": "Hercules — iPhone Preview",
            "start_url": "/", "display": "standalone",
            "icons": [{"src": "/app-icon-192.png"}, {"src": "/app-icon-512.png"}]
        }).encode(), "application/manifest+json")
    if path == "/service-worker.js":
        return response(b'const CACHE="hercules-shell-v2";', "application/javascript")
    if path in ("/app-icon-192.png", "/app-icon-512.png"):
        size = 192 if "192" in path else 512
        return response(b"\x89PNG\r\n\x1a\n" + b"\0" * 8 + size.to_bytes(4, "big") * 2, "image/png")
    raise ValueError(path)


class PreviewSmokeTests(unittest.TestCase):
    def test_positive_does_not_claim_chat_or_release(self):
        result = probe.run_probe(demo)
        self.assertTrue(result["static_preview_reachable"])
        self.assertFalse(result["ai_operational"])
        self.assertFalse(result["release_approved"])
        self.assertEqual([x["path"] for x in result["checks"]], list(probe.PATHS))
        self.assertEqual(result["status"], "preview_assets_verified")

    def test_no_preview_notice_blocks_release_evidence(self):
        def fetch(path):
            return response(b'<h1>App store AI release</h1>') if path == "/" else demo(path)
        result = probe.run_probe(fetch)
        self.assertFalse(result["static_preview_reachable"])
        self.assertIn("preview_notice_missing", [x["reason"] for x in result["checks"]])

    def test_malfunctioning_media_returns_blocked_not_false_success(self):
        def fetch(path):
            return response(b'{"error":"missing"}', "application/json", 503) if path == "/manifest.webmanifest" else demo(path)
        result = probe.run_probe(fetch)
        self.assertFalse(result["static_preview_reachable"])
        self.assertIn("http_503", [x["reason"] for x in result["checks"]])

    def test_preview_has_fixed_origin_and_never_follows_redirects(self):
        self.assertEqual(probe.ORIGIN, "https://hercules-iphone-ui-preview.onrender.com")
        self.assertIsNone(probe.NoRedirect().redirect_request(None, None, 302, "", {}, "http://localhost"))
        self.assertEqual(len(probe.PATHS), 5)

    def test_request_errors_do_not_expose_private_details(self):
        def fetch(path):
            if path == "/": raise TimeoutError("token-should-not-surface")
            return demo(path)
        result = probe.run_probe(fetch)
        self.assertFalse(result["static_preview_reachable"])
        self.assertNotIn("token-should-not-surface", str(result))
        self.assertIn("request_unavailable", [x["reason"] for x in result["checks"]])


if __name__ == "__main__":
    unittest.main()
