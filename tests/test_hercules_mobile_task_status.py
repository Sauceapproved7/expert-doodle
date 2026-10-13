import importlib.util
import sys
import unittest
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "hercules-mobile-control" / "task_status.py"
spec = importlib.util.spec_from_file_location("hercules_mobile_task_status", PATH)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class TaskStatusTests(unittest.TestCase):
    def test_lifecycle(self):
        registry = module.TaskRegistry()
        task = registry.create()
        self.assertEqual(registry.get(task.id).state, "queued")
        registry.transition(task.id, "running", "Started")
        registry.transition(task.id, "succeeded", "Complete")
        self.assertEqual(registry.get(task.id).state, "succeeded")

    def test_terminal_state_cannot_reopen(self):
        registry = module.TaskRegistry()
        task = registry.create()
        registry.transition(task.id, "failed", "No executor")
        with self.assertRaises(ValueError):
            registry.transition(task.id, "running", "Retry")

    def test_unknown_task_rejected(self):
        registry = module.TaskRegistry()
        self.assertIsNone(registry.get("missing"))
        with self.assertRaises(KeyError):
            registry.transition("missing", "running", "Started")

    def test_invalid_state_and_message_rejected(self):
        registry = module.TaskRegistry()
        task = registry.create()
        with self.assertRaises(ValueError):
            registry.transition(task.id, "unauthorized", "Bad state")
        with self.assertRaises(ValueError):
            registry.transition(task.id, "running", "x" * 501)


if __name__ == "__main__":
    unittest.main()
