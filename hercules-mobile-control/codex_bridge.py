"""Server-side Codex executor bridge.

The bridge is OFF unless an authorized HTTPS executor endpoint and token are
configured in server environment. It never uses a browser-held API secret.
The upstream must implement POST /tasks -> {"task_id":"..."}.
"""
import json
import os
from urllib import request, error, parse


class ExecutorUnavailable(RuntimeError):
    pass


class CodexHTTPExecutor:
    def __init__(self, base_url: str, token: str):
        parsed = parse.urlsplit(base_url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("executor must have an HTTPS base URL")
        if not token:
            raise ValueError("executor token required")
        self.base_url = base_url.rstrip("/")
        self.token = token

    def submit(self, instruction: str) -> str:
        payload = json.dumps({"instruction": instruction}).encode()
        req = request.Request(
            self.base_url + "/tasks",
            data=payload,
            method="POST",
            headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"},
        )
        try:
            with request.urlopen(req, timeout=15) as response:
                if response.status != 202:
                    raise ExecutorUnavailable("executor rejected task")
                data = json.load(response)
        except (error.URLError, TimeoutError, ValueError, OSError) as exc:
            raise ExecutorUnavailable("executor unavailable") from exc
        task_id = data.get("task_id") if isinstance(data, dict) else None
        if not isinstance(task_id, str) or not 1 <= len(task_id) <= 128:
            raise ExecutorUnavailable("invalid executor response")
        return task_id


def configured_executor():
    url = os.getenv("HERCULES_CODEX_EXECUTOR_URL", "").strip()
    token = os.getenv("HERCULES_CODEX_EXECUTOR_TOKEN", "").strip()
    if not url or not token:
        return None
    return CodexHTTPExecutor(url, token)
