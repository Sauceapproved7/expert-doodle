import unittest
from pathlib import Path

HTML = (Path(__file__).resolve().parents[1] / "hercules-mobile-control" / "index.html").read_text(encoding="utf-8")

class MobileControlSafetyTests(unittest.TestCase):
    def test_execution_is_disabled(self):
        self.assertIn('id="submit" type="button" disabled', HTML)

    def test_no_browser_embedded_credentials(self):
        self.assertNotIn("Authorization: Bearer", HTML)
        self.assertNotIn("localStorage", HTML)
        self.assertNotIn("sessionStorage", HTML)

    def test_mobile_and_accessibility(self):
        self.assertIn('name="viewport"', HTML)
        self.assertIn('for="task"', HTML)
        self.assertIn('role="status"', HTML)

    def test_task_input_bounded(self):
        self.assertIn('maxlength="4000"', HTML)

    def test_disconnected_status_is_truthful(self):
        self.assertIn("Not connected — execution locked", HTML)

if __name__ == "__main__":
    unittest.main()
