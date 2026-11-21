import pytest
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.tests.factories import TEST_PASSWORD

pytestmark = pytest.mark.django_db

TOKEN_URL = "/api/v1/auth/token/"
REFRESH_URL = "/api/v1/auth/token/refresh/"
ME_URL = "/api/v1/auth/me/"


def login(client, email, password=TEST_PASSWORD):
    return client.post(TOKEN_URL, {"email": email, "password": password}, format="json")


def test_login_returns_rs256_tokens_with_role_claims(api_client, customer_user):
    response = login(api_client, customer_user.email)

    assert response.status_code == 200
    assert set(response.json()) == {"access", "refresh"}
    access = AccessToken(response.json()["access"])
    assert access["role"] == "customer"
    assert access["customer_id"] == customer_user.customer.id


def test_access_token_header_uses_rs256(api_client, staff_user):
    import jwt

    response = login(api_client, staff_user.email)
    header = jwt.get_unverified_header(response.json()["access"])
    assert header["alg"] == "RS256"


def test_staff_token_has_null_customer_id(api_client, staff_user):
    access = AccessToken(login(api_client, staff_user.email).json()["access"])
    assert access["role"] == "staff"
    assert access["customer_id"] is None


def test_login_is_case_insensitive_on_email(api_client, customer_user):
    assert login(api_client, customer_user.email.upper()).status_code == 200


def test_wrong_password_returns_401_envelope(api_client, customer_user):
    response = login(api_client, customer_user.email, "wrong-password")

    assert response.status_code == 401
    error = response.json()["error"]
    assert error["code"] == "invalid_credentials"
    assert error["request_id"] == response["X-Request-ID"]


def test_refresh_rotates_and_keeps_claims(api_client, customer_user):
    tokens = login(api_client, customer_user.email).json()

    response = api_client.post(REFRESH_URL, {"refresh": tokens["refresh"]}, format="json")

    assert response.status_code == 200
    body = response.json()
    assert body["refresh"] != tokens["refresh"]
    assert AccessToken(body["access"])["role"] == "customer"


@pytest.mark.parametrize("fixture", ["staff_user", "customer_user"])
def test_me_returns_identity(request, auth_client, fixture):
    user = request.getfixturevalue(fixture)

    response = auth_client(user).get(ME_URL)

    assert response.status_code == 200
    expected_customer_id = user.customer.id if fixture == "customer_user" else None
    assert response.json() == {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "customer_id": expected_customer_id,
    }


def test_me_without_token_is_401(api_client):
    response = api_client.get(ME_URL)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"
    assert "Bearer" in response["WWW-Authenticate"]


def test_me_with_garbage_token_is_401(api_client):
    api_client.credentials(HTTP_AUTHORIZATION="Bearer not-a-jwt")
    response = api_client.get(ME_URL)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "token_invalid"


def test_token_endpoint_is_throttled(api_client, customer_user):
    statuses = [login(api_client, customer_user.email, "wrong").status_code for _ in range(11)]
    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429
