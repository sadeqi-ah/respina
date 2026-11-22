import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.core.tests.factories import CustomerFactory, UserFactory, access_token_for


@pytest.fixture(autouse=True)
def _fast_password_hasher(settings):
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture(autouse=True)
def _plain_static_storage(settings):
    # The manifest storage needs `collectstatic`, which only runs in the image build.
    settings.STORAGES = {
        **settings.STORAGES,
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }


@pytest.fixture(autouse=True)
def _clear_cache():
    # Throttle counters live in the cache; keep tests independent.
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def staff_user(db):
    return UserFactory(role=Role.STAFF, email="staff@example.com")


@pytest.fixture
def customer_user(db):
    user = UserFactory(role=Role.CUSTOMER, email="owner@example.com")
    CustomerFactory(user=user)
    return user


@pytest.fixture
def auth_client():
    """auth_client(user) -> APIClient with a Bearer token for that user."""

    def make(user) -> APIClient:
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token_for(user)}")
        return client

    return make
