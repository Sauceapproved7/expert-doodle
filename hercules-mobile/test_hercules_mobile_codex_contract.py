import unittest
from hercules_mobile_codex_contract import authorize_mobile_request, validate_task, submit_mobile_task

class MobileCodexContractTests(unittest.TestCase):
    def test_missing_secret_denied(self):
        self.assertFalse(authorize_mobile_request("x", ""))
    def test_wrong_token_denied(self):
        self.assertFalse(authorize_mobile_request("wrong", "correct"))
    def test_valid_token_accepted(self):
        self.assertTrue(authorize_mobile_request("correct", "correct"))
    def test_empty_task_denied(self):
        self.assertFalse(validate_task("  "))
    def test_oversized_task_denied(self):
        self.assertFalse(validate_task("a" * 4001))
    def test_valid_task(self):
        self.assertTrue(validate_task("Run unit tests"))
    def test_unauthorized_submission_denied(self):
        self.assertEqual(submit_mobile_task("test", "wrong", configured_token="right").reason, "unauthorized")
    def test_unregistered_executor_denied(self):
        self.assertEqual(submit_mobile_task("test", "right", configured_token="right").reason, "codex_executor_not_registered")
    def test_registered_but_unconfigured_denied(self):
        self.assertEqual(submit_mobile_task("test", "right", configured_token="right", executor_registered=True).reason, "dispatch_adapter_not_configured")

if __name__ == "__main__":
    unittest.main()
