import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PATH = Path(__file__).resolve().parents[1] / "hercules-mobile-control" / "codex_bridge.py"
spec = importlib.util.spec_from_file_location("hercules_mobile_codex_bridge", PATH)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class BridgeTests(unittest.TestCase):
    def test_missing_configuration_disables_bridge(self):
        with patch.dict("os.environ", {}, clear=True):
            self.assertIsNone(module.configured_executor())

    def test_https_required(self):
        with self.assertRaises(ValueError):
            module.CodexHTTPExecutor("http://example.com", "token")

    def test_credentials_required(self):
        with self.assertRaises(ValueError):
            module.CodexHTTPExecutor("https://example.com", "")

    def test_url_credentials_rejected(self):
        with self.assertRaises(ValueError):
            module.CodexHTTPExecutor("https://user:password@example.com", "token")

    def test_configured_bridge(self):
        with patch.dict("os.environ", {"HERCULES_CODEX_EXECUTOR_URL": "https://example.com", "HERCULES_CODEX_EXECUTOR_TOKEN": "test-token"}, clear=True):
            self.assertIsInstance(module.configured_executor(), module.CodexHTTPExecutor)


if __name__ == "__main__":
    unittest.main()
