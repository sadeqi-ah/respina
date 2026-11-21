"""Two staff members change the same service at the same moment (real separate connections)."""

import threading

import pytest
from django.db import connection

from apps.accounts.models import Role
from apps.cloud.models import Service, ServiceStatusLog
from apps.cloud.use_cases import change_service_status
from apps.core.errors import InvalidStatusTransition
from apps.core.tests.factories import ServiceFactory, UserFactory

pytestmark = pytest.mark.django_db(transaction=True)


def test_concurrent_identical_changes_serialize_on_the_row_lock():
    service = ServiceFactory()
    staff = UserFactory(role=Role.STAFF)
    barrier = threading.Barrier(2)
    outcomes: list[str] = []
    lock = threading.Lock()

    def attempt():
        try:
            barrier.wait()
            change_service_status(service_id=service.id, target_status="suspended", actor=staff)
            result = "ok"
        except InvalidStatusTransition:
            result = "conflict"
        finally:
            connection.close()  # each thread has its own DB connection
        with lock:
            outcomes.append(result)

    threads = [threading.Thread(target=attempt) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    assert sorted(outcomes) == ["conflict", "ok"]
    assert Service.objects.get(pk=service.pk).status == "suspended"
    assert ServiceStatusLog.objects.filter(service=service).count() == 1
