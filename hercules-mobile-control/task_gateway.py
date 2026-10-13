"""Fail-closed Codex task boundary for Hercules Mobile.

This module intentionally does not call Codex. A server-side executor must be
registered and authorized before this boundary can be enabled.
"""
from dataclasses import dataclass
from typing import Protocol
import secrets


@dataclass(frozen=True)
class TaskRequest:
    instruction: str


class TaskExecutor(Protocol):
    def submit(self, instruction: str) -> str: ...


def validate_instruction(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("instruction must be a string")
    value = value.strip()
    if not value or len(value) > 4000:
        raise ValueError("instruction must contain 1 to 4000 characters")
    return value


class TaskGateway:
    def __init__(self, token: str, executor: TaskExecutor | None = None):
        self._token = token
        self._executor = executor

    def submit(self, authorization: str, instruction: object) -> dict:
        if not self._token or not secrets.compare_digest(authorization, f"Bearer {self._token}"):
            return {"status": 401, "error": "unauthorized"}
        try:
            validated = validate_instruction(instruction)
        except ValueError as exc:
            return {"status": 400, "error": str(exc)}
        if self._executor is None:
            return {"status": 503, "error": "executor_not_registered"}
        return {"status": 202, "task_id": self._executor.submit(validated)}
