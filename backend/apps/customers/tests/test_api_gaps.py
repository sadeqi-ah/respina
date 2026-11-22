"""1.8 gap coverage: validation edges, pagination on real endpoints, nested-list query counts."""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.core.tests.factories import CustomerFactory, ServiceFactory

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/customers/"
VALID = {
    "first_name": "Ali",
    "last_name": "Rezaei",
    "email": "ali@example.com",
    "phone": "09121234567",
}


@pytest.fixture
def staff(auth_client, staff_user):
    return auth_client(staff_user)


def codes(response, field):
    assert response.status_code == 400, response.content
    return [d["code"] for d in response.json()["error"]["details"][field]]


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [
        ("first_name", "", "blank"),
        ("last_name", "   ", "blank"),
        ("first_name", "x" * 101, "max_length"),
        ("email", f"{'a' * 250}@x.com", "max_length"),
        ("email", "ali@", "invalid"),
        ("phone", "", "blank"),
        ("phone", "1" * 40, "max_length"),
        ("phone", "+1 555", "invalid_phone"),
    ],
)
def test_customer_validation_edges(staff, field, value, code):
    assert code in codes(staff.post(LIST_URL, {**VALID, field: value}, format="json"), field)


@pytest.mark.parametrize("field", ["first_name", "email", "phone"])
def test_null_values_are_rejected(staff, field):
    assert codes(staff.post(LIST_URL, {**VALID, field: None}, format="json"), field) == ["null"]


@pytest.mark.parametrize(
    ("payload", "field", "code"),
    [
        ({"name": "", "service_type": "vps"}, "name", "blank"),
        ({"name": "x" * 101, "service_type": "vps"}, "name", "max_length"),
        ({"name": "ok"}, "service_type", "required"),
        ({"name": "ok", "service_type": "toaster"}, "service_type", "invalid_choice"),
    ],
)
def test_service_validation_edges(staff, payload, field, code):
    customer = CustomerFactory()
    url = f"/api/v1/customers/{customer.id}/services/"
    assert codes(staff.post(url, payload, format="json"), field) == [code]


def test_customer_list_pagination_envelope_and_cap(staff):
    CustomerFactory.create_batch(105)
    body = staff.get(LIST_URL, {"page_size": 500}).json()
    assert set(body) == {"count", "page", "page_size", "total_pages", "results"}
    assert (body["count"], body["page_size"], body["total_pages"]) == (105, 100, 2)
    assert len(body["results"]) == 100


def test_services_list_pagination(staff):
    customer = CustomerFactory()
    ServiceFactory.create_batch(25, customer=customer)
    body = staff.get(f"/api/v1/customers/{customer.id}/services/", {"page": 2}).json()
    assert (body["count"], body["page"], body["page_size"], len(body["results"])) == (25, 2, 20, 5)


def _query_count(client, url):
    with CaptureQueriesContext(connection) as ctx:
        assert client.get(url, {"page_size": 100}).status_code == 200
    return len(ctx.captured_queries)


def test_services_list_query_count_is_constant(staff):
    customer = CustomerFactory()
    url = f"/api/v1/customers/{customer.id}/services/"
    ServiceFactory(customer=customer)
    baseline = _query_count(staff, url)
    ServiceFactory.create_batch(50, customer=customer)
    assert _query_count(staff, url) == baseline


def test_status_history_query_count_is_constant(staff):
    service = ServiceFactory()
    url = f"/api/v1/services/{service.id}/status-history/"
    status_url = f"/api/v1/services/{service.id}/status/"
    staff.post(status_url, {"status": "suspended"}, format="json")
    baseline = _query_count(staff, url)
    for target in ["active", "suspended"] * 10:
        staff.post(status_url, {"status": target}, format="json")
    assert _query_count(staff, url) == baseline
