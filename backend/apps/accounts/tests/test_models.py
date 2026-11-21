import pytest
from django.db import IntegrityError, transaction

from apps.accounts.models import Role, User

pytestmark = pytest.mark.django_db


def test_create_user_defaults_to_customer_and_normalizes_email():
    user = User.objects.create_user("Ali@Example.COM", "pw-123456!")
    assert (user.email, user.role, user.is_staff, user.is_superuser) == (
        "ali@example.com",
        Role.CUSTOMER,
        False,
        False,
    )
    assert user.check_password("pw-123456!")


def test_create_superuser_is_staff_role_with_admin_access():
    admin = User.objects.create_superuser("admin@example.com", "pw-123456!")
    assert (admin.role, admin.is_staff, admin.is_superuser) == (Role.STAFF, True, True)


def test_email_is_required():
    with pytest.raises(ValueError):
        User.objects.create_user("", "pw")


def test_user_email_unique_case_insensitively():
    User.objects.create_user("a@example.com", "pw")
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.create(email="A@EXAMPLE.COM")


def test_db_rejects_unknown_role():
    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.create(email="x@example.com", role="root")
