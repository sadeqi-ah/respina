import pytest

pytestmark = pytest.mark.django_db


def test_healthz_ok(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response["X-Request-ID"]


def test_openapi_schema_has_shared_error_envelope(client):
    response = client.get("/api/schema/", HTTP_ACCEPT="application/vnd.oai.openapi+json")
    assert response.status_code == 200
    schema = response.json()
    assert "ErrorEnvelope" in schema["components"]["schemas"]
    me = schema["paths"]["/api/v1/auth/me/"]["get"]["responses"]
    assert me["401"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorEnvelope"
    }


def test_swagger_ui_is_served(client):
    assert client.get("/api/docs/").status_code == 200
