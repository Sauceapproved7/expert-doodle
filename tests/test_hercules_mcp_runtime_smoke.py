"""Exercise the actual Hercules FastAPI routes with a deliberately absent loopback model.

No production credentials, external model URL or network usage outside loopback.
A healthy web process must NEVER imply that public AI chat is ready.
"""
import os
import pathlib
import sys
import unittest

os.environ["HERCULES_MODEL_BASE_URL"]="http://127.0.0.1:9"
os.environ["HERCULES_DEFAULT_MODEL"]="hercules-lab-does-not-exist"
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"hercules-ai"))

from fastapi.testclient import TestClient
from app.main import app

class ScopedMcpRuntimeSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._client_context=TestClient(app)
        cls.client=cls._client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls._client_context.__exit__(None,None,None)

    def test_healthy_process_does_not_unlock_inference(self):
        client=self.client
        health=client.get("/health")
        self.assertEqual(health.status_code,200)
        self.assertEqual(health.json().get("service"),"hercules-ai")
        readiness=client.get("/ready")
        self.assertEqual(readiness.status_code,503)
        body=readiness.json()
        self.assertFalse(body["model_inventory_ready"])
        self.assertFalse(body["chat_inference_verified"])
        self.assertFalse(body["public_release_approved"])
        self.assertEqual(body["reason"],"model_backend_unavailable")
        self.assertNotIn("127.0.0.1",str(body))
        self.assertNotIn("hercules-lab-does-not-exist",str(body))

    def test_model_registry_does_not_fabricate_installed_models(self):
        response=self.client.get("/v1/models")
        self.assertEqual(response.status_code,502)

if __name__=="__main__":
    unittest.main()
