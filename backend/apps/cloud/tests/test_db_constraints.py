"""The database itself enforces the ON DELETE rules of plan §3.2, for writers that bypass Django."""

import pytest
from django.db import connection

from apps.accounts.models import Role
from apps.cloud.models import ServiceStatusLog
from apps.cloud.use_cases import change_service_status
from apps.core.tests.factories import CustomerFactory, ServiceFactory, UserFactory
from apps.customers.models import Customer

pytestmark = pytest.mark.django_db

# confdeltype codes: c = CASCADE, n = SET NULL, a = NO ACTION, r = RESTRICT
EXPECTED = {
    ("service_status_logs", "service_id"): "c",
    ("service_status_logs", "changed_by_id"): "n",
    ("customers", "user_id"): "n",
    ("services", "customer_id"): "a",  # PROTECT: deleting a customer with services must fail
}


def _on_delete(table: str, column: str) -> str:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT con.confdeltype FROM pg_constraint con
            JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
            WHERE con.contype = 'f' AND con.conrelid = %s::regclass AND att.attname = %s
            """,
            [table, column],
        )
        return cursor.fetchone()[0]


@pytest.mark.parametrize(("table", "column"), list(EXPECTED))
def test_foreign_key_on_delete_action(table, column):
    """Guards against a future AlterField silently recreating a constraint without the clause."""
    assert _on_delete(table, column) == EXPECTED[(table, column)]


def _raw(sql: str, params: list) -> None:
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        # Constraints are DEFERRABLE INITIALLY DEFERRED; check now, inside the test transaction.
        cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")


def test_raw_delete_of_service_cascades_to_its_audit_log():
    staff = UserFactory(role=Role.STAFF)
    service = ServiceFactory()
    change_service_status(service_id=service.id, target_status="suspended", actor=staff)

    _raw("DELETE FROM services WHERE id = %s", [service.id])

    assert not ServiceStatusLog.objects.filter(service_id=service.id).exists()


def test_raw_delete_of_user_nulls_references():
    staff = UserFactory(role=Role.STAFF)
    login = UserFactory(role=Role.CUSTOMER)
    customer = CustomerFactory(user=login)
    service = ServiceFactory(customer=customer)
    change_service_status(service_id=service.id, target_status="suspended", actor=staff)

    _raw("DELETE FROM accounts_user WHERE id IN (%s, %s)", [staff.id, login.id])

    assert ServiceStatusLog.objects.get(service=service).changed_by_id is None
    assert Customer.objects.get(pk=customer.pk).user_id is None


def test_raw_delete_of_customer_with_services_is_still_refused():
    from django.db import IntegrityError, transaction

    service = ServiceFactory()
    with pytest.raises(IntegrityError), transaction.atomic():
        _raw("DELETE FROM customers WHERE id = %s", [service.customer_id])
