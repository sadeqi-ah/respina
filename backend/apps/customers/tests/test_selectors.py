import pytest
from django.contrib.auth.models import AnonymousUser

from apps.accounts.models import Role
from apps.core.tests.factories import CustomerFactory, ServiceFactory, UserFactory
from apps.customers.selectors import visible_customers_for

pytestmark = pytest.mark.django_db


@pytest.fixture
def two_customers():
    """Alice has a login and 2 services; Bob has a login and 1 service."""
    alice = CustomerFactory(user=UserFactory(role=Role.CUSTOMER))
    bob = CustomerFactory(user=UserFactory(role=Role.CUSTOMER))
    ServiceFactory.create_batch(2, customer=alice)
    ServiceFactory(customer=bob)
    return alice, bob


def test_staff_sees_all_customers(two_customers):
    staff = UserFactory(role=Role.STAFF)
    assert set(visible_customers_for(staff)) == set(two_customers)


def test_staff_gets_services_count(two_customers):
    alice, bob = two_customers
    staff = UserFactory(role=Role.STAFF)
    counts = {c.id: c.services_count for c in visible_customers_for(staff)}
    assert counts == {alice.id: 2, bob.id: 1}


def test_customer_sees_only_own_record(two_customers):
    alice, _ = two_customers
    assert list(visible_customers_for(alice.user)) == [alice]


def test_customer_gets_services_count_for_own_record(two_customers):
    alice, _ = two_customers
    assert visible_customers_for(alice.user).get().services_count == 2


def test_customer_cannot_fetch_another_customer_by_id(two_customers):
    alice, bob = two_customers
    assert not visible_customers_for(alice.user).filter(pk=bob.pk).exists()


def test_customer_login_without_customer_record_sees_nothing(two_customers):
    orphan = UserFactory(role=Role.CUSTOMER)
    assert not visible_customers_for(orphan).exists()


@pytest.mark.parametrize("user", [AnonymousUser(), None])
def test_anonymous_sees_nothing(two_customers, user):
    assert not visible_customers_for(user).exists()


def test_inactive_staff_sees_nothing(two_customers):
    inactive = UserFactory(role=Role.STAFF, is_active=False)
    assert not visible_customers_for(inactive).exists()


def test_services_count_does_not_multiply_rows(two_customers):
    """Annotating a Count over a join must not duplicate customers."""
    staff = UserFactory(role=Role.STAFF)
    assert visible_customers_for(staff).count() == 2
