"""Permission matrix (plan §3.3): every endpoint for every kind of caller, exact status codes.

Callers:
  anonymous  no token
  owner      customer login that owns customer A and service S
  other      customer login with its own customer record (not A)
  staff      role=staff

Another customer's resources must return 404, not 403 (no ID enumeration).
"""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.core.tests.factories import (
    CustomerFactory,
    ServiceFactory,
    UserFactory,
    access_token_for,
)

pytestmark = pytest.mark.django_db

ACTORS = ["anonymous", "owner", "other", "staff"]

NEW_CUSTOMER = {
    "first_name": "Sara",
    "last_name": "Ahmadi",
    "email": "sara@example.com",
    "phone": "09121112233",
}
NEW_SERVICE = {"name": "matrix-svc", "service_type": "vps"}

# (method, url template, body). {customer} = customer A, {service} = service S (owned by A).
ENDPOINTS = {
    "me": ("get", "/api/v1/auth/me/", None),
    "list_customers": ("get", "/api/v1/customers/", None),
    "create_customer": ("post", "/api/v1/customers/", NEW_CUSTOMER),
    "retrieve_customer": ("get", "/api/v1/customers/{customer}/", None),
    "list_services": ("get", "/api/v1/customers/{customer}/services/", None),
    "create_service": ("post", "/api/v1/customers/{customer}/services/", NEW_SERVICE),
    "retrieve_service": ("get", "/api/v1/services/{service}/", None),
    "status_history": ("get", "/api/v1/services/{service}/status-history/", None),
    "change_status": ("post", "/api/v1/services/{service}/status/", {"status": "suspended"}),
}

# Expected HTTP status per endpoint, in ACTORS order: (anonymous, owner, other, staff).
EXPECTED: dict[str, tuple[int, int, int, int]] = {
    "me": (401, 200, 200, 200),
    "list_customers": (401, 200, 200, 200),  # scoped list; "other" sees only own record
    "create_customer": (401, 403, 403, 201),  # staff-only write
    "retrieve_customer": (401, 200, 404, 200),  # hidden object -> 404, not 403
    "list_services": (401, 200, 404, 200),
    "create_service": (401, 403, 403, 201),  # role check runs before object lookup
    "retrieve_service": (401, 200, 404, 200),
    "status_history": (401, 200, 404, 200),
    "change_status": (401, 403, 403, 200),  # staff-only; role check before lookup
}


@pytest.fixture
def world():
    owner_user = UserFactory(role=Role.CUSTOMER)
    customer = CustomerFactory(user=owner_user)
    service = ServiceFactory(customer=customer)
    other_user = UserFactory(role=Role.CUSTOMER)
    CustomerFactory(user=other_user)
    return {
        "customer": customer,
        "service": service,
        "users": {
            "anonymous": None,
            "owner": owner_user,
            "other": other_user,
            "staff": UserFactory(role=Role.STAFF),
        },
    }


def client_for(user) -> APIClient:
    client = APIClient()
    if user is not None:
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token_for(user)}")
    return client


def test_matrix_covers_every_endpoint():
    assert set(EXPECTED) == set(ENDPOINTS)


@pytest.mark.parametrize("endpoint", list(ENDPOINTS))
@pytest.mark.parametrize("actor", ACTORS)
def test_permission_matrix(world, endpoint, actor):
    method, template, body = ENDPOINTS[endpoint]
    url = template.format(customer=world["customer"].id, service=world["service"].id)
    expected = EXPECTED[endpoint][ACTORS.index(actor)]

    response = getattr(client_for(world["users"][actor]), method)(url, body, format="json")

    assert response.status_code == expected, response.content
    if expected >= 400:
        assert "error" in response.json()


# --- IDOR: list endpoints must not leak other customers' rows --------------------------------


def test_other_customers_list_excludes_customer_a(world):
    body = client_for(world["users"]["other"]).get("/api/v1/customers/").json()
    ids = [c["id"] for c in body["results"]]
    assert world["customer"].id not in ids
    assert len(ids) == 1


def test_404_for_hidden_and_missing_ids_is_identical(world):
    """A hidden ID and a non-existent ID must be indistinguishable."""
    client = client_for(world["users"]["other"])
    hidden = client.get(f"/api/v1/services/{world['service'].id}/").json()["error"]
    missing = client.get("/api/v1/services/99999999/").json()["error"]
    assert {k: hidden[k] for k in ("code", "message")} == {
        k: missing[k] for k in ("code", "message")
    }
