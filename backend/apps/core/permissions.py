from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import Role


def _is_staff_role(user) -> bool:
    return bool(user and user.is_authenticated and user.role == Role.STAFF)


class IsStaffRole(BasePermission):
    """Only users with role=staff. Note: role, not Django's is_staff (admin access)."""

    def has_permission(self, request, view) -> bool:
        return _is_staff_role(request.user)


class IsStaffOrReadOnly(BasePermission):
    """Reads for any authenticated user (data scoping happens in selectors); writes for staff."""

    def has_permission(self, request, view) -> bool:
        if not (request.user and request.user.is_authenticated):
            return False
        return request.method in SAFE_METHODS or _is_staff_role(request.user)
