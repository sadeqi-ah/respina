import io

import pytest
from django.core.management import CommandError, call_command

from apps.accounts.models import Role, User
from apps.cloud.models import Service, ServiceStatusLog
from apps.core.tests.factories import CustomerFactory, ServiceFactory
from apps.customers.models import Customer

pytestmark = pytest.mark.django_db

SEED_ENV = {
    "SEED_ADMIN_EMAIL": "admin@example.com",
    "SEED_ADMIN_PASSWORD": "Admin-pass-123!",
    "SEED_CUSTOMER_PASSWORD": "Customer-pass-123!",
}


@pytest.fixture(autouse=True)
def seed_env(monkeypatch):
    for key, value in SEED_ENV.items():
        monkeypatch.setenv(key, value)


def seed(*args):
    call_command("seed", *args, stdout=io.StringIO())


def snapshot():
    return {
        "customers": list(
            Customer.objects.order_by("email").values_list("email", "first_name", "phone")
        ),
        "services": list(
            Service.objects.order_by("customer__email", "name").values_list(
                "customer__email", "name", "service_type", "status"
            )
        ),
        "logs": ServiceStatusLog.objects.count(),
    }


def test_seed_creates_admin_customers_logins_and_history():
    seed("--customers", "10")

    admin = User.objects.get(email="admin@example.com")
    assert (admin.role, admin.is_superuser) == (Role.STAFF, True)
    assert admin.check_password(SEED_ENV["SEED_ADMIN_PASSWORD"])

    assert Customer.objects.count() == 10
    for i in (1, 2, 3):
        login = User.objects.get(email=f"customer{i}@example.com")
        assert login.role == Role.CUSTOMER
        assert login.customer.email == f"customer{i}@example.com"
        assert login.check_password(SEED_ENV["SEED_CUSTOMER_PASSWORD"])

    assert ServiceStatusLog.objects.filter(source="admin").exists()
    assert all(c.phone.startswith("+989") for c in Customer.objects.all())


def test_service_125_exists_and_sequence_is_moved_past_it():
    seed("--customers", "5")

    assert Service.objects.filter(pk=125).exists()
    assert ServiceFactory().pk > 125  # no PK collision for the next insert


def test_seed_is_idempotent():
    seed("--customers", "12")
    first = snapshot()
    seed("--customers", "12")
    assert snapshot() == first
    assert User.objects.filter(email="admin@example.com").count() == 1


def test_seed_is_deterministic_across_reset(monkeypatch):
    monkeypatch.setattr("apps.cloud.management.commands.seed.assert_reset_allowed", lambda: None)
    seed("--customers", "12")
    first = snapshot()
    seed("--customers", "12", "--reset")
    assert snapshot() == first


def test_reset_keeps_staff_and_removes_non_seed_customers(monkeypatch):
    monkeypatch.setattr("apps.cloud.management.commands.seed.assert_reset_allowed", lambda: None)
    stray = CustomerFactory()
    ServiceFactory(customer=stray)
    seed("--customers", "5", "--reset")
    assert not Customer.objects.filter(pk=stray.pk).exists()
    assert User.objects.filter(role=Role.STAFF).exists()


def test_seeded_logins_can_get_tokens(api_client):
    seed("--customers", "5")
    response = api_client.post(
        "/api/v1/auth/token/",
        {"email": "customer1@example.com", "password": SEED_ENV["SEED_CUSTOMER_PASSWORD"]},
        format="json",
    )
    assert response.status_code == 200


def test_missing_env_is_a_clear_error(monkeypatch):
    monkeypatch.delenv("SEED_ADMIN_PASSWORD")
    with pytest.raises(CommandError, match="SEED_ADMIN_PASSWORD"):
        seed()


def test_too_few_customers_is_rejected():
    with pytest.raises(CommandError):
        seed("--customers", "2")


@pytest.mark.parametrize("value", [None, "", "false", "0"])
def test_reset_is_blocked_without_explicit_opt_in(monkeypatch, value):
    seed()
    before = Customer.objects.count()
    if value is None:
        monkeypatch.delenv("SEED_ALLOW_RESET", raising=False)
    else:
        monkeypatch.setenv("SEED_ALLOW_RESET", value)
    with pytest.raises(CommandError, match="SEED_ALLOW_RESET"):
        seed("--reset")
    assert Customer.objects.count() == before  # nothing deleted


def test_reset_runs_with_explicit_opt_in(monkeypatch):
    monkeypatch.setenv("SEED_ALLOW_RESET", "true")
    seed()
    seed("--reset")
    assert Customer.objects.count() == 30
