"""Write-side operations for services. Views stay thin; transactions live here."""

import logging

from django.conf import settings
from django.db import OperationalError, connection, transaction
from django.shortcuts import get_object_or_404

from apps.core.errors import ServiceBusy

from .models import Service, ServiceStatusLog, StatusChangeSource
from .selectors import visible_services_for
from .transitions import assert_transition_allowed

logger = logging.getLogger(__name__)

LOCK_NOT_AVAILABLE = "55P03"


def _set_local_lock_timeout() -> None:
    """Bound the row-lock wait for this transaction only (= SET LOCAL lock_timeout).

    set_config(..., true) is used instead of SET because psycopg 3 binds parameters server-side
    and SET can't take one. Being transaction-local, it never leaks into the persistent
    connection (CONN_MAX_AGE) that the next request reuses.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('lock_timeout', %s, true)", [settings.DB_LOCK_TIMEOUT])


def change_service_status(
    *,
    service_id: int,
    target_status: str,
    actor,
    reason: str = "",
    source: str = StatusChangeSource.API,
) -> Service:
    """Move a service to `target_status` and write exactly one audit row, atomically.

    The service row is locked (SELECT … FOR UPDATE) so two concurrent changes serialize:
    the second one sees the first one's result and is validated against it.

    The wait for that lock is bounded by DB_LOCK_TIMEOUT.

    Raises Http404 if the service isn't visible to `actor`, InvalidStatusTransition if the
    state machine rejects the change, and ServiceBusy if another transaction holds the row
    longer than DB_LOCK_TIMEOUT. In every case nothing is written.
    """
    try:
        with transaction.atomic():
            _set_local_lock_timeout()
            service = get_object_or_404(
                visible_services_for(actor).select_for_update(of=("self",)), pk=service_id
            )
            current = service.status
            assert_transition_allowed(current, target_status)

            service.status = target_status
            service.save(update_fields=["status", "updated_at"])
            ServiceStatusLog.objects.create(
                service=service,
                from_status=current,
                to_status=target_status,
                changed_by=actor,
                source=source,
                reason=reason,
            )
    except OperationalError as exc:
        # The atomic block has already rolled back here.
        # Only a lock-wait timeout is "busy". Anything else (dropped connection, ...) is not ours
        # to translate: re-raise it unchanged so it still becomes a 500/503.
        if getattr(exc.__cause__, "sqlstate", None) != LOCK_NOT_AVAILABLE:
            raise
        # request_id is added to the record by RequestIDFilter.
        logger.warning(
            "service_busy: lock wait exceeded DB_LOCK_TIMEOUT",
            extra={"service_id": int(service_id)},  # the view passes the URL kwarg as str
        )
        raise ServiceBusy() from exc
    return service
