"""Read-side data scoping for customers (plan §3.3).

Every customer-facing read goes through `visible_customers_for`, so a customer can never see
another customer's record. Views call it from `get_queryset()`; an object outside the queryset
becomes a 404 (not a 403), so callers can't probe which IDs exist.
"""

from django.db.models import Count, QuerySet

from apps.accounts.models import Role

from .models import Customer


def visible_customers_for(user) -> QuerySet[Customer]:
    """Customers `user` may see, annotated with `services_count`.

    - staff role      → all customers
    - customer role   → only the customer linked to this login
    - anyone else     → nothing (anonymous, None, unexpected role)
    """
    if user is None or not user.is_authenticated or not user.is_active:
        return Customer.objects.none()

    base = Customer.objects.annotate(services_count=Count("services", distinct=True))

    if user.role == Role.STAFF:
        return base
    if user.role == Role.CUSTOMER:
        return base.filter(user=user)

    # Unexpected role → nothing.
    return Customer.objects.none()
