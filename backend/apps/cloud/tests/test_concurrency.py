"""Two staff members change the same service at the same moment (real separate connections)."""

import logging
import threading
import time

import pytest
from django.db import connection, transaction

from apps.accounts.models import Role
from apps.cloud.models import Service, ServiceStatusLog
from apps.cloud.use_cases import change_service_status
from apps.core.errors import InvalidStatusTransition
from apps.core.tests.factories import ServiceFactory, UserFactory, access_token_for

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


def test_status_change_behind_a_held_row_lock_is_409_service_busy(api_client, settings, caplog):
    settings.DB_LOCK_TIMEOUT = "200ms"
    service = ServiceFactory()
    staff = UserFactory(role=Role.STAFF)
    locked, release = threading.Event(), threading.Event()

    def hold_lock():
        try:
            with transaction.atomic():
                Service.objects.select_for_update().get(pk=service.pk)
                locked.set()
                release.wait(timeout=10)
        finally:
            connection.close()

    holder = threading.Thread(target=hold_lock)
    holder.start()
    try:
        assert locked.wait(timeout=5)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token_for(staff)}")
        started = time.monotonic()
        with caplog.at_level(logging.WARNING, logger="apps.cloud.use_cases"):
            response = api_client.post(
                f"/api/v1/services/{service.pk}/status/",
                {"status": "suspended"},
                format="json",
                HTTP_X_REQUEST_ID="lock-test-1",
            )
        elapsed = time.monotonic() - started
    finally:
        release.set()
        holder.join(timeout=10)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "service_busy"
    assert response.json()["error"]["request_id"] == "lock-test-1"
    assert elapsed < 2  # gave up after ~200ms instead of waiting for the holder

    warning = next(r for r in caplog.records if r.levelno == logging.WARNING)
    assert warning.service_id == service.pk
    assert warning.request_id == "lock-test-1"

    assert Service.objects.get(pk=service.pk).status == "active"
    assert not ServiceStatusLog.objects.filter(service=service).exists()
    # SET LOCAL ended with the transaction: the (reused) connection is back to no limit.
    with connection.cursor() as cursor:
        cursor.execute("SHOW lock_timeout")
        assert cursor.fetchone()[0] == "0"
