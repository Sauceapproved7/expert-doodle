"""Model inventory readiness must not assert inference without evidence.

Standalone unittest; no provider credentials, third-party imports or network.
"""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
FILE = ROOT / "hercules-ai" / "app" / "model_readiness.py"
spec = importlib.util.spec_from_file_location("hercules_model_readiness", FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ModelReadinessTests(unittest.TestCase):
    def test_default_model_found_is_only_inventory_ready(self):
        result = module.evaluate_model_inventory(
            {"models": [{"name": "qwen2.5:7b", "size": 4420000000}]},
            default_model="qwen2.5:7b",
        )
        self.assertTrue(result["model_inventory_ready"])
        self.assertFalse(result["chat_inference_verified"])
        self.assertFalse(result["public_release_approved"])
        self.assertEqual(result["reason"], "default_model_found")
        self.assertNotIn("models", result)

    def test_empty_model_registry_blocks_readiness(self):
        result = module.evaluate_model_inventory({"models": []}, default_model="qwen2.5:7b")
        self.assertFalse(result["model_inventory_ready"])
        self.assertEqual(result["reason"], "default_model_missing")

    def test_other_model_installed_is_not_proof_selected_model_exists(self):
        result = module.evaluate_model_inventory(
            {"models": [{"name": "qwen2.5:0.5b"}]}, default_model="qwen2.5:7b"
        )
        self.assertFalse(result["model_inventory_ready"])
        self.assertEqual(result["reason"], "default_model_missing")

    def test_malformed_or_non_dict_registry_fails_closed(self):
        for inventory in [None, "ok", ["model"], {"models": "fake"}, {"models": [{}]},
                          {"models": [42]}, {"models": [{"name": None}]}]:
            with self.subTest(inventory=inventory):
                result = module.evaluate_model_inventory(inventory, default_model="qwen2.5:7b")
                self.assertFalse(result["model_inventory_ready"])
                self.assertEqual(result["reason"], "invalid_model_inventory")

    def test_invalid_default_model_does_not_match_empty(self):
        for chosen in ["", " ", None, 123, "  qwen2.5:7b  "]:
            with self.subTest(chosen=chosen):
                result = module.evaluate_model_inventory(
                    {"models": [{"name": "qwen2.5:7b"}]}, default_model=chosen
                )
                self.assertFalse(result["model_inventory_ready"])

    def test_provider_records_cannot_smuggle_secrets_into_status(self):
        record = {
            "models": [{
                "name": "qwen2.5:7b", "token": "PRIVATE-OWNER-TOKEN",
                "endpoint": "http://internal-ollama:11434", "parameters": {"private": "SECRET"}
            }]
        }
        result = module.evaluate_model_inventory(record, default_model="qwen2.5:7b")
        self.assertTrue(result["model_inventory_ready"])
        self.assertNotIn("PRIVATE-OWNER-TOKEN", str(result))
        self.assertNotIn("internal-ollama", str(result))
        self.assertNotIn("SECRET", str(result))
        self.assertNotIn("qwen2.5:7b", str(result))

    def test_endpoint_uses_bounded_read_only_get_and_503_not_health(self):
        source = (ROOT / "hercules-ai" / "app" / "main.py").read_text()
        self.assertIn('@app.get("/ready")', source)
        self.assertIn('evaluate_model_inventory(data, DEFAULT)', source)
        self.assertIn('httpx.AsyncClient(timeout=5,follow_redirects=False)', source)
        self.assertIn('JSONResponse(status_code=503', source)
        self.assertIn('chat_inference_verified', (ROOT / "hercules-ai" / "app" / "model_readiness.py").read_text())
        self.assertIn('@app.get("/health")', source)
        self.assertNotIn('os.getenv("HERCULES_MCP_TOKEN"', (ROOT / "hercules-ai" / "app" / "model_readiness.py").read_text())


if __name__ == "__main__":
    unittest.main()
