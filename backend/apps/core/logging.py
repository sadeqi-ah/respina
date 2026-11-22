import json
import logging
from datetime import UTC, datetime

from .request_context import get_request_id

# Fields that callers may attach with `extra=` (see RequestTimingMiddleware). Only these are
# copied into the JSON, and only when present, so other log lines keep their exact shape.
EXTRA_FIELDS = ("method", "path", "status", "duration_ms")


class RequestIDFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


class JSONFormatter(logging.Formatter):
    """One JSON object per line: easy to ship to any log collector."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
        }
        for field in EXTRA_FIELDS:
            if hasattr(record, field):
                payload[field] = getattr(record, field)
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)
