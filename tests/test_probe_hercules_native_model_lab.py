"""Independent credential-free tests of Hercules native model lab boundary."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import probe_hercules_native_model_lab as probe


def good_response(path):
    if path == "/health":
        return probe.Response(
            200, "application/json",
            b'{"ok":true,"service":"hercules-model-plane","version":"0.1",'
            b'"models":8,"active":8,"embeddedRuntimes":8,'
            b'"candidateEvaluationEnabled":false,"candidateRuntimes":0}'
        )
    return probe.Response(401, "application/json", b'{"error":"unauthorized"}')


class ModelLabProbeTests(unittest.TestCase):
    def test_positive_proves_only_native_runtimes_and_access_boundary(self):
        result=probe.evaluate_probe(good_response)
        self.assertTrue(result["native_model_lab_checked"])
        self.assertFalse(result["chat_inference_verified"])
        self.assertFalse(result["production_connected"])
        self.assertFalse(result["public_release_approved"])
        self.assertEqual(len(result["checks"]),3)

    def test_healthy_process_without_embedded_runtimes_fails(self):
        def fetch(path):
            if path=="/health":
                return probe.Response(200, "application/json",b'{"ok":true,"service":"hercules-model-plane","models":8,"active":8,"embeddedRuntimes":0,"candidateEvaluationEnabled":false,"candidateRuntimes":0}')
            return good_response(path)
        result=probe.evaluate_probe(fetch)
        self.assertFalse(result["native_model_lab_checked"])
        self.assertIn("runtime_count_mismatch",[c["reason"] for c in result["checks"]])

    def test_protected_inventory_must_reject_anonymous_access(self):
        def fetch(path):
            if path=="/v1/models":
                return probe.Response(200, "application/json",b'{"models":[]}')
            return good_response(path)
        result=probe.evaluate_probe(fetch)
        self.assertFalse(result["native_model_lab_checked"])
        self.assertIn("protected_route_exposed",[c["reason"] for c in result["checks"]])

    def test_candidate_evaluation_enabling_fails_closed(self):
        def fetch(path):
            if path=="/health":
                return probe.Response(200,"application/json",b'{"ok":true,"service":"hercules-model-plane","models":8,"active":8,"embeddedRuntimes":8,"candidateEvaluationEnabled":true,"candidateRuntimes":3}')
            return good_response(path)
        result=probe.evaluate_probe(fetch)
        self.assertFalse(result["native_model_lab_checked"])
        self.assertIn("candidate_evaluation_enabled",[c["reason"] for c in result["checks"]])

    def test_missing_or_malformed_responses_are_not_success(self):
        for response in [probe.Response(502,"application/json",b'{}'), probe.Response(200,"text/html",b'<html>fallback</html>'),probe.Response(200,"application/json",b'garbled')]:
            with self.subTest(response=response):
                result=probe.evaluate_probe(lambda path: response if path=="/health" else good_response(path))
                self.assertFalse(result["native_model_lab_checked"])

    def test_errors_remain_sanitized_and_fixed_origin_only(self):
        self.assertEqual(probe.ORIGIN,"https://hercules-native-model-plane-lab.onrender.com")
        self.assertEqual(probe.PATHS,("/health","/v1/models","/v1/candidates"))
        def fails(path):
            if path=="/v1/candidates":
                raise TimeoutError("internal-host.example/secret-123")
            return good_response(path)
        result=probe.evaluate_probe(fails)
        self.assertFalse(result["native_model_lab_checked"])
        self.assertNotIn("internal-host.example",str(result))
        self.assertNotIn("secret-123",str(result))


if __name__=="__main__":
    unittest.main()
