"""Read-side data scoping for services (plan §3.3). Mirrors apps.customers.selectors."""

from django.db.models import QuerySet

from apps.accounts.models import Role

from .models import Service, ServiceStatusLog


def visible_services_for(user) -> QuerySet[Service]:
    """Services `user` may see.

    - staff role      → all services
    - customer role   → only services of the customer linked to this login
    - anyone else     → nothing (anonymous, None, inactive, unexpected role)

    Also used with `.select_for_update()` by the status-change use case, so it must stay a
    plain queryset over `services` (no aggregates).
    """
    if user is None or not user.is_authenticated or not user.is_active:
        return Service.objects.none()

    if user.role == Role.STAFF:
        return Service.objects.all()
    if user.role == Role.CUSTOMER:
        return Service.objects.filter(customer__user=user)

    return Service.objects.none()


def status_history_for(user, service_id: int) -> QuerySet[ServiceStatusLog]:
    """Status log of one service, newest first; empty if the service isn't visible."""
    return ServiceStatusLog.objects.filter(
        service__in=visible_services_for(user).filter(pk=service_id)
    ).order_by("-created_at", "-id")
