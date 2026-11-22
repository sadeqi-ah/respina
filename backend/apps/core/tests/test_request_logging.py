import json
import logging

import pytest

from apps.core.logging import JSONFormatter

pytestmark = pytest.mark.django_db

LOGGER = "apps.core.request"


@pytest.fixture
def request_records(caplog):
    caplog.set_level(logging.INFO, logger=LOGGER)

    def records():
        return [r for r in caplog.records if r.name == LOGGER and r.getMessage() == "request"]

    return records


def test_request_is_logged_once_with_timing(client, request_records):
    response = client.get("/healthz?token=should-not-appear")

    [record] = request_records()
    assert record.levelname == "INFO"
    assert record.method == "GET"
    assert record.path == "/healthz"  # path only, never the query string
    assert record.status == 200
    assert isinstance(record.duration_ms, int)
    assert record.duration_ms >= 0
    assert record.request_id == response["X-Request-ID"]


def test_json_formatter_keeps_request_fields(client, request_records):
    response = client.get("/healthz")

    [record] = request_records()
    line = JSONFormatter().format(record)
    assert "\n" not in line
    payload = json.loads(line)
    assert payload["message"] == "request"
    assert payload["logger"] == LOGGER
    assert payload["method"] == "GET"
    assert payload["path"] == "/healthz"
    assert payload["status"] == 200
    assert isinstance(payload["duration_ms"], int)
    assert payload["request_id"] == response["X-Request-ID"]


def test_json_formatter_unchanged_for_other_lines():
    record = logging.LogRecord("x", logging.INFO, __file__, 1, "hello", None, None)
    assert set(json.loads(JSONFormatter().format(record))) == {
        "time",
        "level",
        "logger",
        "message",
        "request_id",
    }


def test_incoming_request_id_is_logged(client, request_records):
    client.get("/healthz", HTTP_X_REQUEST_ID="caller-id-123")

    [record] = request_records()
    assert record.request_id == "caller-id-123"


def test_404_is_logged(client, request_records):
    client.get("/no-such-page")

    [record] = request_records()
    assert record.status == 404
    assert record.path == "/no-such-page"


@pytest.mark.urls("apps.core.tests.urls")
def test_unhandled_exception_is_logged_as_500(api_client, request_records):
    api_client.raise_request_exception = False
    response = api_client.get("/boom")

    [record] = request_records()
    assert record.status == 500
    assert record.request_id == response["X-Request-ID"]
