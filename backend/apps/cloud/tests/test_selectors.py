import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import transaction

from apps.accounts.models import Role
from apps.cloud.models import ServiceStatusLog
from apps.cloud.selectors import status_history_for, visible_services_for
from apps.core.tests.factories import CustomerFactory, ServiceFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def services():
    """Alice owns 2 services, Bob owns 1; both have logins."""
    alice = CustomerFactory(user=UserFactory(role=Role.CUSTOMER))
    bob = CustomerFactory(user=UserFactory(role=Role.CUSTOMER))
    return {
        "alice": alice,
        "bob": bob,
        "alice_services": ServiceFactory.create_batch(2, customer=alice),
        "bob_service": ServiceFactory(customer=bob),
    }


def test_staff_sees_all_services(services):
    staff = UserFactory(role=Role.STAFF)
    assert visible_services_for(staff).count() == 3


def test_customer_sees_only_own_services(services):
    visible = set(visible_services_for(services["alice"].user))
    assert visible == set(services["alice_services"])


def test_customer_cannot_fetch_another_customers_service(services):
    alice_user = services["alice"].user
    bob_service = services["bob_service"]
    assert not visible_services_for(alice_user).filter(pk=bob_service.pk).exists()


def test_customer_login_without_customer_record_sees_nothing(services):
    assert not visible_services_for(UserFactory(role=Role.CUSTOMER)).exists()


@pytest.mark.parametrize("user", [AnonymousUser(), None])
def test_anonymous_sees_nothing(services, user):
    assert not visible_services_for(user).exists()


def test_inactive_staff_sees_nothing(services):
    assert not visible_services_for(UserFactory(role=Role.STAFF, is_active=False)).exists()


def test_queryset_supports_select_for_update(services):
    """The status use case locks the row through this selector."""
    staff = UserFactory(role=Role.STAFF)
    with transaction.atomic():
        locked = visible_services_for(staff).select_for_update().get(pk=services["bob_service"].pk)
    assert locked.pk == services["bob_service"].pk


def _log(service, from_status, to_status):
    return ServiceStatusLog.objects.create(
        service=service, from_status=from_status, to_status=to_status, source="api"
    )


def test_status_history_is_newest_first_for_owner(services):
    service = services["alice_services"][0]
    first = _log(service, "active", "suspended")
    second = _log(service, "suspended", "active")

    history = list(status_history_for(services["alice"].user, service.id))

    assert history == [second, first]


def test_status_history_of_another_customers_service_is_empty(services):
    _log(services["bob_service"], "active", "suspended")
    assert not status_history_for(services["alice"].user, services["bob_service"].id).exists()
