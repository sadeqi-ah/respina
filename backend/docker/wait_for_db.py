"""Block until PostgreSQL accepts connections, or exit non-zero after a deadline.

Runs before `migrate` in the container entrypoint. Compose also waits for the db healthcheck,
but this keeps the image correct when started any other way (plain `docker run`, k8s, CI).
Reads DATABASE_URL; WAIT_FOR_DB_TIMEOUT (seconds, default 60) caps the total wait.
"""

import os
import sys
import time

import psycopg


def wait_for_db(url: str, timeout: float) -> bool:
    """Return True once a connection to `url` succeeds, False if `timeout` seconds pass first."""
    deadline = time.monotonic() + timeout  # monotonic: immune to wall-clock changes
    delay = 0.5
    attempt = 0
    while True:
        attempt += 1
        try:
            # connect_timeout keeps one attempt from hanging past the deadline; `with` closes it.
            with psycopg.connect(url, connect_timeout=3):
                return True
        except psycopg.OperationalError as exc:  # refused, DNS not ready, "system is starting up"
            # Anything else (e.g. a malformed URL) is not caught: fail now, not after the timeout.
            reason = str(exc).strip().splitlines()[0] if str(exc).strip() else type(exc).__name__
            print(f"waiting for database (attempt {attempt}): {reason}", flush=True)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False
        time.sleep(min(delay, remaining))
        delay = min(delay * 2, 5.0)


def main() -> int:
    url = os.environ["DATABASE_URL"]
    timeout = float(os.environ.get("WAIT_FOR_DB_TIMEOUT", "60"))
    if wait_for_db(url, timeout):
        print("database is ready", flush=True)
        return 0
    print(f"database not reachable after {timeout:.0f}s", file=sys.stderr, flush=True)
    return 1


if __name__ == "__main__":
    sys.exit(main())
