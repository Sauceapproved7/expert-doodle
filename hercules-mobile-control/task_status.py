"""In-memory, fail-closed task status tracking for isolated Hercules testing.

Not durable or production-ready. Does not execute tasks.
"""
from dataclasses import dataclass
from threading import Lock
from uuid import uuid4

_ALLOWED = {"queued", "running", "succeeded", "failed"}


@dataclass(frozen=True)
class TaskStatus:
    id: str
    state: str
    message: str


class TaskRegistry:
    def __init__(self):
        self._tasks: dict[str, TaskStatus] = {}
        self._lock = Lock()

    def create(self) -> TaskStatus:
        task = TaskStatus(uuid4().hex, "queued", "Awaiting authorized executor")
        with self._lock:
            self._tasks[task.id] = task
        return task

    def get(self, task_id: str) -> TaskStatus | None:
        with self._lock:
            return self._tasks.get(task_id)

    def transition(self, task_id: str, state: str, message: str) -> TaskStatus:
        if state not in _ALLOWED or not isinstance(message, str) or len(message) > 500:
            raise ValueError("invalid task update")
        with self._lock:
            previous = self._tasks.get(task_id)
            if previous is None:
                raise KeyError(task_id)
            transitions = {
                "queued": {"running", "failed"},
                "running": {"succeeded", "failed"},
                "succeeded": set(),
                "failed": set(),
            }
            if state not in transitions[previous.state]:
                raise ValueError("invalid task transition")
            updated = TaskStatus(task_id, state, message)
            self._tasks[task_id] = updated
            return updated
