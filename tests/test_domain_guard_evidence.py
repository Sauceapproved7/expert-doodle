"""Read-only Domain Guard evidence tests: python -m unittest discover -s tests -p 'test_domain_guard_evidence.py'."""
import unittest
from scripts.domain_guard_evidence import compare_shopify_dns, summarize_tls


class DomainGuardEvidenceTests(unittest.TestCase):
    def test_ready_records(self):
        observed = {"A": ["23.227.38.65"], "AAAA": ["2620:127:f00f:5::"], "www_CNAME": ["shops.myshopify.com."]}
        result = compare_shopify_dns(observed)
        self.assertTrue(result["matches"])
        self.assertEqual(result["mismatches"], [])

    def test_missing_record_is_not_ready(self):
        result = compare_shopify_dns({"A": ["23.227.38.65"], "AAAA": [], "www_CNAME": []})
        self.assertFalse(result["matches"])
        self.assertEqual({x["type"] for x in result["mismatches"]}, {"AAAA", "www_CNAME"})

    def test_extra_addresses_are_reported(self):
        result = compare_shopify_dns({"A": ["23.227.38.65", "192.0.2.4"], "AAAA": ["2620:127:f00f:5::"], "www_CNAME": ["shops.myshopify.com"]})
        self.assertFalse(result["matches"])

    def test_tls_expiry_is_not_auth_proof(self):
        result = summarize_tls({"notAfter": "Dec 31 23:59:59 2030 GMT"}, now="2026-10-12T00:00:00+00:00")
        self.assertTrue(result["valid_at_check"])
        self.assertNotIn("registrar_authorized", result)


if __name__ == "__main__":
    unittest.main()
