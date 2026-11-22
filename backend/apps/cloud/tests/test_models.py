import pytest
from django.db import IntegrityError, connection, transaction
from django.db.models import ProtectedError

from apps.cloud.models import ServiceStatusLog
from apps.core.tests.factories import CustomerFactory, ServiceFactory

pytestmark = pytest.mark.django_db


def test_db_rejects_invalid_status_written_with_raw_sql():
    service = ServiceFactory()
    with pytest.raises(IntegrityError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("UPDATE services SET status = 'deleted' WHERE id = %s", [service.id])


def test_db_rejects_invalid_service_type_written_with_raw_sql():
    service = ServiceFactory()
    with pytest.raises(IntegrityError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("UPDATE services SET service_type = 'toaster' WHERE id = %s", [service.id])


def test_customer_email_is_unique_case_insensitively():
    CustomerFactory(email="ali@example.com")
    with pytest.raises(IntegrityError), transaction.atomic():
        CustomerFactory(email="ALI@Example.com")


def test_service_name_is_unique_per_customer_case_insensitively():
    service = ServiceFactory(name="web-prod-1")
    ServiceFactory(name="web-prod-1")  # another customer: fine
    with pytest.raises(IntegrityError), transaction.atomic():
        ServiceFactory(customer=service.customer, name="WEB-PROD-1")


@pytest.mark.parametrize("bad", ["", "  Ali", "Ali  "])
def test_customer_names_must_be_trimmed_and_non_empty(bad):
    with pytest.raises(IntegrityError), transaction.atomic():
        CustomerFactory(first_name=bad)


def test_customer_phone_must_be_e164():
    with pytest.raises(IntegrityError), transaction.atomic():
        CustomerFactory(phone="09121234567")


def test_deleting_customer_with_services_is_protected():
    service = ServiceFactory()
    with pytest.raises(ProtectedError):
        service.customer.delete()


def test_status_log_db_defaults_allow_minimal_insert_from_other_writers():
    """The PHP module inserts logs with plain SQL; created_at and reason come from the DB."""
    service = ServiceFactory()
    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO service_status_logs (service_id, from_status, to_status, source) "
            "VALUES (%s, 'active', 'suspended', 'php_module') RETURNING id",
            [service.id],
        )
        (log_id,) = cursor.fetchone()
    log = ServiceStatusLog.objects.get(id=log_id)
    assert log.reason == ""
    assert log.created_at is not None


def test_new_service_gets_db_defaults():
    service = ServiceFactory()
    assert service.status == "active"
    assert service.created_at is not None
