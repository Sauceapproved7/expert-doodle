"""Minimal Hercules production app backport: no commerce, credentials or rollout."""
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class ScopedMcpCandidate(unittest.TestCase):
    def test_ui_is_fail_closed_until_real_model_inventory(self):
        html=(ROOT/"hercules-ai/ui/index.html").read_text()
        self.assertIn("let modelReady=false;",html)
        self.assertIn("send.disabled=true;",html)
        self.assertIn('fetch("/v1/models"',html)
        self.assertIn("if(!modelReady)return;",html)
        self.assertIn("Chat response capability is not yet verified.",html)

    def test_sw_does_not_cache_authenticated_api_or_cross_origin(self):
        sw=(ROOT/"hercules-ai/ui/service-worker.js").read_text()
        self.assertIn('hercules-shell-v2',sw)
        self.assertIn('request.method !== "GET"',sw)
        self.assertIn("url.origin !== self.location.origin",sw)
        self.assertIn('request.mode === "navigate"',sw)
        self.assertIn("STATIC_PATHS.has",sw)
        self.assertNotIn("/v1/chat/completions",sw)

    def test_model_ready_never_certifies_chat_release(self):
        source=(ROOT/"hercules-ai/app/main.py").read_text()
        self.assertIn('@app.get("/ready")',source)
        self.assertIn("evaluate_model_inventory(data, DEFAULT)",source)
        self.assertIn('"public_release_approved":False',source)
        self.assertIn('"chat_inference_verified":False',source)
        self.assertIn('httpx.AsyncClient(timeout=5,follow_redirects=False)',source)

if __name__=="__main__":
    unittest.main()
