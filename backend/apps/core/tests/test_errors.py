import pytest

from apps.core.tests.factories import CustomerFactory, ServiceFactory, UserFactory

pytestmark = [pytest.mark.django_db, pytest.mark.urls("apps.core.tests.urls")]


def assert_envelope(response, status, code):
    assert response.status_code == status, response.content
    error = response.json()["error"]
    assert error["code"] == code
    assert isinstance(error["message"], str) and error["message"]
    assert error["request_id"] == response["X-Request-ID"]
    return error


@pytest.mark.parametrize(
    ("url", "status", "code"),
    [
        ("/http404", 404, "not_found"),
        ("/not-found", 404, "not_found"),
        ("/django-forbidden", 403, "permission_denied"),
        ("/forbidden", 403, "permission_denied"),
        ("/transition", 409, "invalid_status_transition"),
        ("/throttled", 429, "throttled"),
        ("/auth-required", 401, "not_authenticated"),
    ],
)
def test_mapped_errors(api_client, url, status, code):
    assert_envelope(api_client.get(url), status, code)


def test_domain_error_message_is_passed_through(api_client):
    error = assert_envelope(api_client.get("/transition"), 409, "invalid_status_transition")
    assert error["message"] == "Already active."


def test_throttled_sets_retry_after(api_client):
    assert api_client.get("/throttled")["Retry-After"] == "30"


def test_method_not_allowed(api_client):
    response = api_client.post("/get-only")
    assert_envelope(response, 405, "method_not_allowed")
    assert "GET" in response["Allow"]


def test_protected_error_is_409_conflict(api_client):
    service = ServiceFactory()
    assert_envelope(api_client.get(f"/protected?id={service.id}"), 409, "conflict")


def test_unique_violation_race_is_409_conflict(api_client):
    CustomerFactory(email="race@example.com")
    assert_envelope(api_client.get("/unique-race"), 409, "conflict")


@pytest.mark.parametrize("url", ["/boom", "/integrity-other"])
def test_unexpected_errors_are_500_without_internals(api_client, url, caplog):
    api_client.raise_request_exception = False
    response = api_client.get(url)

    assert_envelope(response, 500, "internal_error")
    assert "secret internals" not in response.content.decode()
    assert "Traceback" not in response.content.decode()
    assert any(r.exc_info for r in caplog.records)  # logged with the stack trace


def test_unknown_url_uses_envelope(api_client):
    assert_envelope(api_client.get("/no-such-path"), 404, "not_found")


def test_client_request_id_is_echoed(api_client):
    response = api_client.get("/not-found", HTTP_X_REQUEST_ID="abc-123")
    assert response["X-Request-ID"] == "abc-123"
    assert response.json()["error"]["request_id"] == "abc-123"


def test_unsafe_client_request_id_is_replaced(api_client):
    response = api_client.get("/not-found", HTTP_X_REQUEST_ID="bad id\nwith newline")
    assert response["X-Request-ID"] != "bad id\nwith newline"
    assert len(response["X-Request-ID"]) == 32


# --- validation details: {field: [{code, message}]} ---------------------------------------


def test_missing_fields_report_required(api_client):
    error = assert_envelope(
        api_client.post("/validate", {}, format="json"), 400, "validation_error"
    )
    assert error["details"]["first_name"] == [
        {"code": "required", "message": "This field is required."}
    ]
    assert error["details"]["email"][0]["code"] == "required"


def test_duplicate_email_reports_unique(api_client):
    CustomerFactory(email="ali@example.com")
    payload = {"first_name": "Ali", "email": "ALI@example.com"}

    error = assert_envelope(
        api_client.post("/validate", payload, format="json"), 400, "validation_error"
    )

    assert error["details"]["email"][0] == {
        "code": "unique",
        "message": "A customer with this email already exists.",
    }


def test_multiple_errors_on_one_field_are_all_reported(api_client):
    payload = {"first_name": "x" * 101, "email": "not-an-email"}
    error = assert_envelope(
        api_client.post("/validate", payload, format="json"), 400, "validation_error"
    )
    assert [d["code"] for d in error["details"]["first_name"]] == ["max_length"]
    assert [d["code"] for d in error["details"]["email"]] == ["invalid"]


def test_object_level_errors_use_non_field_errors(api_client):
    payload = {"first_name": "reject", "email": "ok@example.com"}
    error = assert_envelope(
        api_client.post("/validate", payload, format="json"), 400, "validation_error"
    )
    assert error["details"]["non_field_errors"] == [
        {"code": "invalid", "message": "Rejected by an object-level rule."}
    ]


# --- pagination ---------------------------------------------------------------------------


def test_pagination_envelope(api_client):
    UserFactory.create_batch(25)
    body = api_client.get("/users?page=2&page_size=10").json()
    assert {k: body[k] for k in ("count", "page", "page_size", "total_pages")} == {
        "count": 25,
        "page": 2,
        "page_size": 10,
        "total_pages": 3,
    }
    assert len(body["results"]) == 10


def test_page_size_is_capped_at_100(api_client):
    UserFactory.create_batch(101)
    body = api_client.get("/users?page_size=500").json()
    assert body["page_size"] == 100
    assert len(body["results"]) == 100


def test_page_out_of_range_is_404_envelope(api_client):
    assert_envelope(api_client.get("/users?page=99"), 404, "not_found")
