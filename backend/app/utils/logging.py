from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone


def configure_logging() -> None:
    logger = logging.getLogger("safeher")
    if logger.handlers:
        return
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)


def log_event(event: str, **details) -> None:
    logger = logging.getLogger("safeher")
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event,
        **details,
    }
    logger.info(json.dumps(payload, default=str))
