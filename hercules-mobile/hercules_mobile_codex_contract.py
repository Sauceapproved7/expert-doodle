"""Fail-closed mobile task contract for the Hercules Codex bridge.

No executor, credentials, or production deployment authority is supplied here.
"""
import hmac
import os
import re
from dataclasses import dataclass

MAX_INSTRUCTION_LENGTH = 4000
TASK_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,80}$")

@dataclass(frozen=True)
class MobileTaskResult:
    accepted: bool
    status: str
    reason: str

def authorize_mobile_request(presented_token: str | None, configured_token: str | None = None) -> bool:
    expected = configured_token if configured_token is not None else os.environ.get("HERCULES_MOBILE_GATEWAY_TOKEN", "")
    return bool(expected and presented_token and hmac.compare_digest(expected, presented_token))

def validate_task(instruction: object) -> bool:
    return isinstance(instruction, str) and 0 < len(instruction.strip()) <= MAX_INSTRUCTION_LENGTH

def submit_mobile_task(instruction: object, presented_token: str | None, *,
                       configured_token: str | None = None,
                       executor_registered: bool = False) -> MobileTaskResult:
    if not authorize_mobile_request(presented_token, configured_token):
        return MobileTaskResult(False, "rejected", "unauthorized")
    if not validate_task(instruction):
        return MobileTaskResult(False, "rejected", "invalid_instruction")
    if not executor_registered:
        return MobileTaskResult(False, "blocked", "codex_executor_not_registered")
    # This module never executes commands. An audited, owner-scoped executor
    # must implement the actual dispatch separately.
    return MobileTaskResult(False, "blocked", "dispatch_adapter_not_configured")
