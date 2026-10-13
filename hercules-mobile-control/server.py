"""Isolated Hercules Mobile task API. No Codex credentials are exposed to clients.

Fail closed unless HERCULES_MOBILE_TOKEN is configured. Codex execution is
unavailable until a separately authorized server-side adapter is installed.
"""
import json
import os
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from task_gateway import TaskGateway

TOKEN = os.environ.get("HERCULES_MOBILE_TOKEN", "")
PORT = int(os.environ.get("PORT", "8765"))
HOST = os.environ.get("HERCULES_MOBILE_BIND", "127.0.0.1")
INDEX = Path(__file__).with_name("index.html")


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"service": "hercules-mobile", "status": "online", "codex": "disconnected"})
        if self.path == "/status":
            if not self._authorized():
                return self._json(401, {"error": "unauthorized"})
            return self._json(200, {"executor": "not_registered", "submission": "disabled"})
        if self.path == "/":
            body = INDEX.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return self.wfile.write(body)
        return self._json(404, {"error": "not_found"})

    def _authorized(self):
        auth = self.headers.get("Authorization", "")
        return bool(TOKEN) and secrets.compare_digest(auth, "Bearer " + TOKEN)

    def do_POST(self):
        if self.path != "/tasks":
            return self._json(404, {"error": "not_found"})
        if not self._authorized():
            return self._json(401, {"error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self._json(400, {"error": "invalid_length"})
        if length < 1 or length > 8192:
            return self._json(413, {"error": "invalid_body_size"})
        try:
            payload = json.loads(self.rfile.read(length))
        except (UnicodeDecodeError, ValueError):
            return self._json(400, {"error": "invalid_json"})
        if not isinstance(payload, dict):
            return self._json(400, {"error": "invalid_payload"})
        result = TaskGateway(TOKEN).submit(self.headers.get("Authorization", ""), payload.get("instruction"))
        status = result.pop("status")
        return self._json(status, result)


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
