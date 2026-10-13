import importlib.util
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "hercules-mobile-control" / "task_gateway.py"
spec = importlib.util.spec_from_file_location("hercules_mobile_gateway", MODULE)
module = importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class GatewayTests(unittest.TestCase):
    def test_missing_token_rejected(self):
        self.assertEqual(module.TaskGateway("").submit("", "hello")["status"], 401)

    def test_wrong_token_rejected(self):
        self.assertEqual(module.TaskGateway("secret").submit("Bearer wrong", "hello")["status"], 401)

    def test_no_executor_fails_closed(self):
        self.assertEqual(module.TaskGateway("secret").submit("Bearer secret", "hello")["status"], 503)

    def test_invalid_instruction_rejected(self):
        gateway = module.TaskGateway("secret")
        for value in ("", "   ", "x" * 4001, None, 42):
            with self.subTest(value=str(value)[:10]):
                self.assertEqual(gateway.submit("Bearer secret", value)["status"], 400)

    def test_authorized_executor_dispatch(self):
        class Stub:
            def submit(self, instruction):
                self.instruction = instruction
                return "test-task"
        stub = Stub()
        result = module.TaskGateway("secret", stub).submit("Bearer secret", "  fix tests  ")
        self.assertEqual(result, {"status": 202, "task_id": "test-task"})
        self.assertEqual(stub.instruction, "fix tests")


if __name__ == "__main__":
    unittest.main()
