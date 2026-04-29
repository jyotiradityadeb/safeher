from __future__ import annotations

import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check(self, key: str, max_attempts: int, window_seconds: int) -> None:
        now = time.time()
        threshold = now - window_seconds
        with self._lock:
            bucket = [event for event in self._events[key] if event >= threshold]
            if len(bucket) >= max_attempts:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many requests. Retry in {window_seconds} seconds.",
                )
            bucket.append(now)
            self._events[key] = bucket


rate_limiter = InMemoryRateLimiter()


def client_key(request: Request, scope: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{scope}:{host}"
