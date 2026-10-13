import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import probe_hercules_vault_staging as probe

def reply(path, method):
    if path=="/health" and method=="GET":
        return probe.HttpResult(200,"application/json",b'{"ok":true,"service":"hercules-vault-source-assistant","experimental":true,"general_chat_verified":false,"public_release_approved":false}')
    if path=="/v1/vault/ask" and method=="POST":
        return probe.HttpResult(401,"application/json",b'{"error":"unauthorized"}')
    raise AssertionError("unexpected route")

class VaultStagingProbeTests(unittest.TestCase):
    def test_fixed_only_two_allowlisted_requests(self):
        self.assertEqual(probe.ORIGIN,"https://hercules-vault-staging.onrender.com")
        out=probe.check_staging(reply)
        self.assertTrue(out["staging_boundary_verified"])
        self.assertEqual([x["path"] for x in out["checks"]],["/health","/v1/vault/ask"])
        self.assertFalse(out["authenticated_retrieval_verified_externally"])
        self.assertFalse(out["public_release_approved"])

    def test_reject_health_claiming_public_release(self):
        def fetch(path,method):
            if path=="/health":
                return probe.HttpResult(200,"application/json",b'{"ok":true,"service":"hercules-vault-source-assistant","public_release_approved":true,"general_chat_verified":false}')
            return reply(path,method)
        out=probe.check_staging(fetch)
        self.assertFalse(out["staging_boundary_verified"])
        self.assertEqual(out["checks"][0]["reason"],"incorrect_service_or_gate")

    def test_unauthorized_query_cannot_return_document(self):
        def fetch(path,method):
            if path=="/v1/vault/ask":
                return probe.HttpResult(200,"application/json",b'{"found":true,"sources":[{"path":"docs/secret.md"}]}')
            return reply(path,method)
        out=probe.check_staging(fetch)
        self.assertFalse(out["staging_boundary_verified"])
        self.assertEqual(out["checks"][1]["reason"],"unauthenticated_query_exposed")

    def test_network_exceptions_are_sanitized(self):
        def fetch(path,method):
            raise TimeoutError("PRIVATE-SYSTEM-HOST secret")
        out=probe.check_staging(fetch)
        self.assertFalse(out["staging_boundary_verified"])
        self.assertNotIn("PRIVATE-SYSTEM-HOST",str(out))
        self.assertEqual([x["reason"] for x in out["checks"]],["request_unavailable"]*2)

    def test_redirect_not_followed_and_response_limited(self):
        self.assertIsNone(probe.NoRedirect().redirect_request(None,None,302,"",{},"http://localhost"))
        def fetch(path,method):
            if path=="/health":return probe.HttpResult(200,"application/json",b"x"*(probe.BODY_LIMIT+1))
            return reply(path,method)
        out=probe.check_staging(fetch)
        self.assertEqual(out["checks"][0]["reason"],"oversized_response")

if __name__=="__main__":
    unittest.main()
