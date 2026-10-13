import unittest
from fastapi.testclient import TestClient
from app.floodgates import router
from fastapi import FastAPI

class FloodgatesTests(unittest.TestCase):
    def setUp(self):
        app=FastAPI()
        app.include_router(router)
        self.client=TestClient(app)

    def test_readonly_status_is_fail_closed(self):
        result=self.client.get("/floodgates/status")
        self.assertEqual(result.status_code,200)
        payload=result.json()
        self.assertFalse(payload["ready"])
        self.assertFalse(payload["productionAuthorized"])
        self.assertEqual(len(payload["missing"]),9)

    def test_no_write_endpoint(self):
        self.assertEqual(self.client.post("/floodgates/status",json={"ready":True}).status_code,405)

    def test_claimed_evidence_cannot_authorize(self):
        self.assertEqual(self.client.post("/floodgates/activate",json={"owner_launch_approval":True}).status_code,404)

if __name__=="__main__":
    unittest.main()
