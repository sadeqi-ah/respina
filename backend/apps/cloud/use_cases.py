"""Write-side operations for services. Views stay thin; transactions live here."""

from django.db import transaction
from django.shortcuts import get_object_or_404

from .models import Service, ServiceStatusLog, StatusChangeSource
from .selectors import visible_services_for
from .transitions import assert_transition_allowed


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

    Raises Http404 if the service isn't visible to `actor`, and InvalidStatusTransition if
    the state machine rejects the change. Either way nothing is written.
    """
    with transaction.atomic():
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
    return service
