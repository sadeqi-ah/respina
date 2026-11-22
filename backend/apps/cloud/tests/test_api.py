import pytest

from apps.cloud.models import Service, ServiceStatusLog
from apps.core.tests.factories import CustomerFactory, ServiceFactory

pytestmark = pytest.mark.django_db


def detail_url(pk):
    return f"/api/v1/services/{pk}/"


def status_url(pk):
    return f"/api/v1/services/{pk}/status/"


def history_url(pk):
    return f"/api/v1/services/{pk}/status-history/"


@pytest.fixture
def staff(auth_client, staff_user):
    return auth_client(staff_user)


@pytest.fixture
def owner(auth_client, customer_user):
    return auth_client(customer_user)


@pytest.fixture
def own_service(customer_user):
    return ServiceFactory(customer=customer_user.customer)


def error_of(response):
    return response.json()["error"]


# --- retrieve -------------------------------------------------------------------------------


def test_owner_retrieves_own_service(owner, own_service):
    body = owner.get(detail_url(own_service.id)).json()
    assert body["id"] == own_service.id
    assert body["customer_id"] == own_service.customer_id
    assert body["service_type_display"] == "Cloud Server"


def test_customer_gets_404_for_another_customers_service(owner):
    assert owner.get(detail_url(ServiceFactory().id)).status_code == 404


def test_anonymous_gets_401(api_client, own_service):
    assert api_client.get(detail_url(own_service.id)).status_code == 401


# --- status changes -------------------------------------------------------------------------


def test_staff_suspends_and_reactivates_with_audit_rows(staff, staff_user, own_service):
    suspended = staff.post(
        status_url(own_service.id), {"status": "suspended", "reason": "unpaid"}, format="json"
    )
    assert suspended.status_code == 200, suspended.content
    assert suspended.json()["status"] == "suspended"

    reactivated = staff.post(status_url(own_service.id), {"status": "active"}, format="json")
    assert reactivated.json()["status"] == "active"

    logs = list(ServiceStatusLog.objects.filter(service=own_service).order_by("id"))
    assert [(log.from_status, log.to_status) for log in logs] == [
        ("active", "suspended"),
        ("suspended", "active"),
    ]
    assert all(log.changed_by_id == staff_user.id and log.source == "api" for log in logs)
    assert [log.reason for log in logs] == ["unpaid", ""]


def test_status_change_bumps_updated_at(staff, own_service):
    before = own_service.updated_at
    staff.post(status_url(own_service.id), {"status": "suspended"}, format="json")
    own_service.refresh_from_db()
    assert own_service.updated_at > before


def test_same_status_is_409_and_writes_nothing(staff, own_service):
    response = staff.post(status_url(own_service.id), {"status": "active"}, format="json")

    assert response.status_code == 409
    assert error_of(response)["code"] == "invalid_status_transition"
    assert not ServiceStatusLog.objects.exists()


@pytest.mark.parametrize(
    ("payload", "field", "code"),
    [
        ({"status": "deleted"}, "status", "invalid_choice"),
        ({}, "status", "required"),
        ({"status": "suspended", "reason": "x" * 501}, "reason", "max_length"),
    ],
)
def test_invalid_payload_is_400(staff, own_service, payload, field, code):
    response = staff.post(status_url(own_service.id), payload, format="json")
    assert response.status_code == 400
    assert error_of(response)["details"][field][0]["code"] == code
    own_service.refresh_from_db()
    assert own_service.status == "active"


def test_customer_cannot_change_status_even_of_own_service(owner, own_service):
    response = owner.post(status_url(own_service.id), {"status": "suspended"}, format="json")
    assert response.status_code == 403
    assert error_of(response)["code"] == "permission_denied"


def test_anonymous_cannot_change_status(api_client, own_service):
    response = api_client.post(status_url(own_service.id), {"status": "suspended"}, format="json")
    assert response.status_code == 401


def test_missing_service_is_404(staff):
    response = staff.post(status_url(999999), {"status": "suspended"}, format="json")
    assert response.status_code == 404


def test_failed_audit_insert_rolls_back_status(staff, own_service, monkeypatch):
    """Status and audit row are one transaction: if the log insert fails, nothing changes."""

    def boom(*args, **kwargs):
        raise RuntimeError("log insert failed")

    monkeypatch.setattr(ServiceStatusLog.objects, "create", boom)
    staff.raise_request_exception = False

    response = staff.post(status_url(own_service.id), {"status": "suspended"}, format="json")

    assert response.status_code == 500
    assert Service.objects.get(pk=own_service.pk).status == "active"


# --- history --------------------------------------------------------------------------------


def test_history_is_newest_first_and_paginated(staff, owner, own_service):
    staff.post(status_url(own_service.id), {"status": "suspended"}, format="json")
    staff.post(status_url(own_service.id), {"status": "active"}, format="json")

    body = owner.get(history_url(own_service.id)).json()

    assert body["count"] == 2
    assert [(e["from_status"], e["to_status"]) for e in body["results"]] == [
        ("suspended", "active"),
        ("active", "suspended"),
    ]
    assert set(body["results"][0]) == {
        "id",
        "from_status",
        "to_status",
        "changed_by_id",
        "source",
        "reason",
        "created_at",
    }


def test_history_of_another_customers_service_is_404(owner):
    other = ServiceFactory(customer=CustomerFactory())
    assert owner.get(history_url(other.id)).status_code == 404
