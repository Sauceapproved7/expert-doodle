"""Read-only mobile ops regression tests; never require external network access."""
import json
import sys
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1] / "hercules-mobile-control"
sys.path.insert(0, str(ROOT))
import ops_status
import server

class PublicProbeTests(unittest.TestCase):
    def test_allowlist_is_fixed_public_https_and_no_redirect(self):
        self.assertGreaterEqual(len(ops_status.TARGETS), 4)
        for target in ops_status.TARGETS:
            self.assertTrue(target["url"].startswith("https://"))
            self.assertTrue(target["url"].endswith(".onrender.com"))
            self.assertTrue(target["dashboard"].startswith("https://dashboard.render.com/"))
        self.assertIsNone(ops_status.NoRedirect().redirect_request(None, None, 302, "", {}, "http://127.0.0.1/"))

    def test_health_and_fallback_are_truthful(self):
        target = ops_status.TARGETS[0]
        self.assertEqual(ops_status.probe(target, lambda url: 200)["state"], "healthy")
        visited = []
        def no_health(url):
            visited.append(url)
            return 404 if url.endswith("/health") else 200
        result = ops_status.probe(target, no_health)
        self.assertEqual(result["state"], "responding")
        self.assertEqual(len(visited), 2)
        self.assertEqual(ops_status.probe(target, lambda url: 503)["state"], "degraded")
        self.assertEqual(ops_status.probe(target, lambda url: 401)["state"], "protected")

    def test_timeout_is_not_reported_as_offline(self):
        def fail(url):
            raise TimeoutError()
        result = ops_status.probe(ops_status.TARGETS[0], fail)
        self.assertEqual(result["state"], "unconfirmed")
        self.assertIsNone(result["http_code"])

    def test_cache_keeps_checks_bounded(self):
        with patch.object(ops_status, "_cache", None), patch.object(ops_status, "_cached_at", 0), patch.object(ops_status, "probe", side_effect=lambda t: {**t, "state": "responding", "http_code": 200, "detail": "test"}) as probe:
            first = ops_status.get_snapshot()
            second = ops_status.get_snapshot()
            self.assertIs(first, second)
            self.assertEqual(probe.call_count, len(ops_status.TARGETS))
            self.assertIn("Does not verify payments", first["note"])

class HandlerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.worker = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.worker.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.worker.join(timeout=2)

    def get(self, method, path):
        conn = HTTPConnection("127.0.0.1", self.http.server_address[1], timeout=5)
        conn.request(method, path)
        response = conn.getresponse()
        data = response.read()
        headers = dict(response.getheaders())
        conn.close()
        return response.status, headers, data

    def test_read_only_snapshot_access_and_no_cors(self):
        snapshot = {"services": [], "source": "bounded_public_http"}
        with patch.object(server, "get_snapshot", return_value=snapshot):
            status, headers, body = self.get("GET", "/api/ops")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), snapshot)
        self.assertEqual(headers.get("X-Frame-Options"), "DENY")
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_unauthorized_task_and_status_remain_locked(self):
        self.assertEqual(self.get("GET", "/status")[0], 401)
        self.assertEqual(self.get("POST", "/tasks")[0], 401)

    def test_content_security_policy_limits_connections_to_self(self):
        status, headers, body = self.get("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn("connect-src 'self'", headers["Content-Security-Policy"])
        self.assertIn("Not connected — execution locked".encode("utf-8"), body)

if __name__ == "__main__":
    unittest.main()
