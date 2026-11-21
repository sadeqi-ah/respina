import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.accounts.models import Role
from apps.core.tests.factories import CustomerFactory, ServiceFactory, UserFactory
from apps.customers.models import Customer

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/customers/"


def detail_url(pk):
    return f"/api/v1/customers/{pk}/"


def services_url(pk):
    return f"/api/v1/customers/{pk}/services/"


VALID = {
    "first_name": "  Ali ",
    "last_name": "Rezaei",
    "email": "Ali@Example.com",
    "phone": "09121234567",
}


@pytest.fixture
def staff(auth_client, staff_user):
    return auth_client(staff_user)


@pytest.fixture
def owner(auth_client, customer_user):
    return auth_client(customer_user)


def error_of(response):
    return response.json()["error"]


# --- list / retrieve ------------------------------------------------------------------------


def test_staff_lists_all_customers_with_services_count(staff, customer_user):
    other = CustomerFactory()
    ServiceFactory.create_batch(3, customer=other)

    body = staff.get(LIST_URL).json()

    assert body["count"] == 2
    counts = {c["id"]: c["services_count"] for c in body["results"]}
    assert counts == {customer_user.customer.id: 0, other.id: 3}


def test_customer_list_contains_only_own_record(owner, customer_user):
    CustomerFactory.create_batch(3)
    body = owner.get(LIST_URL).json()
    assert [c["id"] for c in body["results"]] == [customer_user.customer.id]


def test_retrieve_shape(staff):
    customer = CustomerFactory(first_name="Ali", last_name="Rezaei", phone="+989121234567")
    ServiceFactory(customer=customer)

    body = staff.get(detail_url(customer.id)).json()

    assert body == {
        "id": customer.id,
        "first_name": "Ali",
        "last_name": "Rezaei",
        "full_name": "Ali Rezaei",
        "email": customer.email,
        "phone": "+989121234567",
        "services_count": 1,
        "created_at": body["created_at"],
    }
    assert body["created_at"].endswith("Z")


def test_customer_gets_404_for_another_customer(owner):
    other = CustomerFactory()
    response = owner.get(detail_url(other.id))
    assert response.status_code == 404
    assert error_of(response)["code"] == "not_found"


def test_anonymous_gets_401(api_client):
    assert api_client.get(LIST_URL).status_code == 401


def test_search_over_name_email_and_phone(staff):
    ali = CustomerFactory(first_name="Ali", email="ali@x.com", phone="+989121111111")
    CustomerFactory(first_name="Sara", email="sara@x.com", phone="+989122222222")

    for term in ["ali", "ali@x", "1111111"]:
        ids = [c["id"] for c in staff.get(LIST_URL, {"search": term}).json()["results"]]
        assert ids == [ali.id], term


@pytest.mark.parametrize("ordering", ["last_name", "-last_name"])
def test_ordering_by_last_name(staff, ordering):
    for name in ["Bahrami", "Ahmadi", "Charmi"]:
        CustomerFactory(last_name=name)
    names = [c["last_name"] for c in staff.get(LIST_URL, {"ordering": ordering}).json()["results"]]
    assert names == sorted(names, reverse=ordering.startswith("-"))


def test_default_ordering_is_newest_first(staff):
    first, second = CustomerFactory(), CustomerFactory()
    ids = [c["id"] for c in staff.get(LIST_URL).json()["results"]]
    assert ids == [second.id, first.id]


def test_list_query_count_is_constant(staff):
    def count_queries():
        with CaptureQueriesContext(connection) as ctx:
            assert staff.get(LIST_URL, {"page_size": 100}).status_code == 200
        return len(ctx.captured_queries)

    CustomerFactory.create_batch(2)
    baseline = count_queries()
    for customer in CustomerFactory.create_batch(20):
        ServiceFactory.create_batch(5, customer=customer)
    assert count_queries() == baseline


# --- create ---------------------------------------------------------------------------------


def test_staff_creates_customer_with_normalized_fields(staff):
    response = staff.post(LIST_URL, VALID, format="json")

    assert response.status_code == 201, response.content
    body = response.json()
    assert body["first_name"] == "Ali"
    assert body["email"] == "ali@example.com"
    assert body["phone"] == "+989121234567"
    assert body["services_count"] == 0
    assert Customer.objects.filter(pk=body["id"]).exists()


def test_customer_cannot_create(owner):
    response = owner.post(LIST_URL, VALID, format="json")
    assert response.status_code == 403
    assert error_of(response)["code"] == "permission_denied"


@pytest.mark.parametrize("phone", ["+989121234567", "00989121234567", "0912 123 4567"])
def test_duplicate_phone_detected_across_formats(staff, phone):
    CustomerFactory(phone="+989121234567")
    response = staff.post(LIST_URL, {**VALID, "phone": phone}, format="json")
    assert response.status_code == 400
    assert error_of(response)["details"]["phone"][0]["code"] == "unique"


def test_duplicate_email_is_case_insensitive(staff):
    CustomerFactory(email="ali@example.com")
    response = staff.post(LIST_URL, {**VALID, "email": "ALI@EXAMPLE.COM"}, format="json")
    assert error_of(response)["details"]["email"][0] == {
        "code": "unique",
        "message": "A customer with this email already exists.",
    }


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [
        ("first_name", "   ", "blank"),
        ("last_name", "x" * 101, "max_length"),
        ("email", "not-an-email", "invalid"),
        ("phone", "12345", "invalid_phone"),
    ],
)
def test_validation_codes(staff, field, value, code):
    response = staff.post(LIST_URL, {**VALID, field: value}, format="json")
    assert response.status_code == 400
    assert error_of(response)["details"][field][0]["code"] == code


def test_missing_fields_are_required(staff):
    details = error_of(staff.post(LIST_URL, {}, format="json"))["details"]
    assert {f: d[0]["code"] for f, d in details.items()} == {
        "first_name": "required",
        "last_name": "required",
        "email": "required",
        "phone": "required",
    }


def test_concurrent_duplicate_insert_maps_to_409(staff, monkeypatch):
    """Simulates the race: the serializer check passes, then the DB constraint fires."""
    from apps.customers.serializers import CustomerSerializer

    CustomerFactory(email="ali@example.com")
    monkeypatch.setattr(CustomerSerializer, "validate_email", lambda self, v: v.lower())

    response = staff.post(LIST_URL, VALID, format="json")

    assert response.status_code == 409
    assert error_of(response)["code"] == "conflict"


# --- nested services ------------------------------------------------------------------------


def test_list_services_with_filters(staff):
    customer = CustomerFactory()
    vps = ServiceFactory(customer=customer, service_type="vps")
    ServiceFactory(customer=customer, service_type="vps", status="suspended")
    ServiceFactory(customer=customer, service_type="object_storage")
    ServiceFactory()  # another customer's

    body = staff.get(services_url(customer.id), {"status": "active", "service_type": "vps"}).json()

    assert body["count"] == 1
    assert body["results"][0] == {
        "id": vps.id,
        "customer_id": customer.id,
        "name": vps.name,
        "service_type": "vps",
        "service_type_display": "VPS",
        "status": "active",
        "created_at": body["results"][0]["created_at"],
        "updated_at": body["results"][0]["updated_at"],
    }


def test_unknown_filter_value_is_validation_error(staff):
    customer = CustomerFactory()
    response = staff.get(services_url(customer.id), {"status": "deleted"})
    assert response.status_code == 400
    assert error_of(response)["details"]["status"][0]["code"] == "invalid_choice"


def test_owner_lists_own_services(owner, customer_user):
    ServiceFactory.create_batch(2, customer=customer_user.customer)
    assert owner.get(services_url(customer_user.customer.id)).json()["count"] == 2


def test_customer_gets_404_for_another_customers_services(owner):
    other = CustomerFactory()
    assert owner.get(services_url(other.id)).status_code == 404


def test_staff_creates_service(staff):
    customer = CustomerFactory()
    payload = {"name": " web-prod-1 ", "service_type": "cloud_server", "status": "suspended"}

    response = staff.post(services_url(customer.id), payload, format="json")

    assert response.status_code == 201, response.content
    body = response.json()
    assert body["name"] == "web-prod-1"
    assert body["status"] == "active"  # status is read-only on create
    assert body["customer_id"] == customer.id


def test_customer_cannot_create_service_even_for_self(owner, customer_user):
    response = owner.post(
        services_url(customer_user.customer.id),
        {"name": "x", "service_type": "vps"},
        format="json",
    )
    assert response.status_code == 403


def test_create_service_for_missing_customer_is_404(staff):
    response = staff.post(services_url(999999), {"name": "x", "service_type": "vps"}, format="json")
    assert response.status_code == 404


def test_duplicate_service_name_per_customer(staff):
    service = ServiceFactory(name="web-prod-1")
    response = staff.post(
        services_url(service.customer_id),
        {"name": "WEB-PROD-1", "service_type": "vps"},
        format="json",
    )
    assert response.status_code == 400
    assert error_of(response)["details"]["name"][0]["code"] == "unique"


def test_unknown_service_type_is_rejected(staff):
    customer = CustomerFactory()
    response = staff.post(
        services_url(customer.id), {"name": "x", "service_type": "toaster"}, format="json"
    )
    assert error_of(response)["details"]["service_type"][0]["code"] == "invalid_choice"


def test_staff_role_not_django_is_staff_grants_access(auth_client):
    """API authorization follows `role`; Django's is_staff only grants admin access."""
    admin_only = UserFactory(role=Role.CUSTOMER, is_staff=True)
    assert auth_client(admin_only).post(LIST_URL, VALID, format="json").status_code == 403
