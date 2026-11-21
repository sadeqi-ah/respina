"""Deterministic demo data (plan Task 1.9).

    python manage.py seed [--customers 30] [--reset]

- Same input, same data: Faker and `random` use a fixed seed.
- Idempotent: rows are keyed by deterministic emails / names, so a second run adds nothing.
- Creates the staff admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD), N customers with 0-6
  services each, logins customer1..3@example.com (SEED_CUSTOMER_PASSWORD), some status
  history, and guarantees service id 125 exists (used in the API docs examples).
"""

import os
import random
import re

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from faker import Faker

from apps.accounts.models import Role, User
from apps.cloud.models import Service, ServiceStatusLog, ServiceType, StatusChangeSource
from apps.cloud.use_cases import change_service_status
from apps.customers.models import Customer
from apps.customers.validators import normalize_phone

SEED = 20261121
DOC_SERVICE_ID = 125
LOGIN_COUNT = 3
MOBILE_PREFIXES = ["0912", "0935", "0901", "0919", "0921", "0990", "0910", "0939"]
SERVICE_NAMES = ["web", "api", "db", "cache", "backup", "media", "mail", "vpn", "ci", "edge"]
SERVICE_ENVS = ["prod", "staging", "dev"]


def _required_env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise CommandError(f"{name} must be set in the environment.")
    return value


def _email(first: str, last: str, index: int) -> str:
    local = re.sub(r"[^a-z0-9]+", ".", f"{first}.{last}".lower()).strip(".")
    return f"{local}.{index}@example.com"


def assert_reset_allowed() -> None:
    """Raise CommandError if `--reset` (which deletes all customers and services) must not run."""
    # Explicit opt-in, not DEBUG or host sniffing: it behaves the same locally and in compose
    # (DEBUG=false there), and nobody wipes a real database without setting it on purpose.
    if os.environ.get("SEED_ALLOW_RESET", "").lower() not in {"1", "true", "yes"}:
        raise CommandError(
            "--reset deletes all customers, services and customer logins. "
            "Set SEED_ALLOW_RESET=true in the environment to confirm."
        )


class Command(BaseCommand):
    help = "Load deterministic demo data. Safe to run repeatedly."

    def add_arguments(self, parser):
        parser.add_argument("--customers", type=int, default=30)
        parser.add_argument(
            "--reset", action="store_true", help="Delete customers/services/history first."
        )

    def handle(self, *args, customers: int, reset: bool, **options):
        if customers < LOGIN_COUNT:
            raise CommandError(f"--customers must be at least {LOGIN_COUNT}.")
        admin_email = _required_env("SEED_ADMIN_EMAIL")
        admin_password = _required_env("SEED_ADMIN_PASSWORD")
        customer_password = _required_env("SEED_CUSTOMER_PASSWORD")

        if reset:
            assert_reset_allowed()

        with transaction.atomic():
            if reset:
                self._reset()
            admin = self._admin(admin_email, admin_password)
            created = self._customers(customers, customer_password, admin)
            self._ensure_doc_service()

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed done: {created} new customers "
                f"({Customer.objects.count()} total, {Service.objects.count()} services)."
            )
        )

    # --- steps ------------------------------------------------------------------------------

    def _reset(self) -> None:
        ServiceStatusLog.objects.all().delete()
        Service.objects.all().delete()
        Customer.objects.all().delete()
        User.objects.filter(role=Role.CUSTOMER).delete()
        self.stdout.write("Reset: deleted customers, services, history and customer logins.")

    def _admin(self, email: str, password: str) -> User:
        admin = User.objects.filter(email__iexact=email).first()
        if admin is None:
            admin = User.objects.create_superuser(email, password)
        return admin

    def _customers(self, count: int, login_password: str, admin: User) -> int:
        fake = Faker("en_US")
        fake.seed_instance(SEED)
        rng = random.Random(SEED)  # noqa: S311 (deterministic demo data, not security)
        used_phones: set[str] = set()
        created = 0

        for i in range(1, count + 1):
            # Draw every random value even for existing rows, so the sequence stays stable.
            first, last = fake.first_name(), fake.last_name()
            phone = self._phone(rng, used_phones)
            service_count = rng.randint(0, 6)
            plans = [self._service_plan(rng) for _ in range(service_count)]

            has_login = i <= LOGIN_COUNT
            email = f"customer{i}@example.com" if has_login else _email(first, last, i)
            customer, is_new = Customer.objects.get_or_create(
                email=email.lower(),
                defaults={"first_name": first, "last_name": last, "phone": phone},
            )
            if not is_new:
                continue
            created += 1
            if has_login:
                customer.user = User.objects.create_user(email, login_password)
                customer.save(update_fields=["user", "updated_at"])
            self._services(customer, plans, admin)
        return created

    def _phone(self, rng: random.Random, used: set[str]) -> str:
        while True:
            phone = normalize_phone(f"{rng.choice(MOBILE_PREFIXES)}{rng.randrange(10**7):07d}")
            if phone not in used:
                used.add(phone)
                return phone

    def _service_plan(self, rng: random.Random) -> tuple[str, str, int]:
        name = f"{rng.choice(SERVICE_NAMES)}-{rng.choice(SERVICE_ENVS)}-{rng.randint(1, 9)}"
        return name, rng.choice(ServiceType.values), rng.randint(0, 9)

    def _services(self, customer: Customer, plans, admin: User) -> None:
        seen: set[str] = set()
        for name, service_type, history_roll in plans:
            if name in seen:
                continue  # names are unique per customer
            seen.add(name)
            service = Service.objects.create(
                customer=customer, name=name, service_type=service_type
            )
            # ~30% suspended, ~20% suspended then reactivated: some realistic history.
            if history_roll < 5:
                self._transition(service, "suspended", admin, "Unpaid invoice")
            if history_roll < 2:
                self._transition(service, "active", admin, "Invoice paid")

    def _transition(self, service: Service, target: str, admin: User, reason: str) -> None:
        change_service_status(
            service_id=service.id,
            target_status=target,
            actor=admin,
            reason=reason,
            source=StatusChangeSource.ADMIN,
        )

    def _ensure_doc_service(self) -> None:
        if Service.objects.filter(pk=DOC_SERVICE_ID).exists():
            return
        customer = Customer.objects.get(email="customer1@example.com")
        Service.objects.create(
            id=DOC_SERVICE_ID,
            customer=customer,
            name="web-prod-docs",
            service_type=ServiceType.CLOUD_SERVER,
        )
        # An explicit id doesn't advance the identity sequence; move it past the max id.
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT setval(pg_get_serial_sequence('services', 'id'), "
                "GREATEST((SELECT MAX(id) FROM services), 1))"
            )
