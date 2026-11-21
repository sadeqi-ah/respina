from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Lower, Now


class ServiceType(models.TextChoices):
    CLOUD_SERVER = "cloud_server", "Cloud Server"
    VPS = "vps", "VPS"
    DEDICATED_SERVER = "dedicated_server", "Dedicated Server"
    OBJECT_STORAGE = "object_storage", "Object Storage"
    MANAGED_DATABASE = "managed_database", "Managed Database"


class ServiceStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"


class StatusChangeSource(models.TextChoices):
    API = "api", "API"
    PHP_MODULE = "php_module", "PHP module"
    ADMIN = "admin", "Admin"


class Service(models.Model):
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.PROTECT, related_name="services"
    )
    name = models.CharField(max_length=100)
    service_type = models.CharField(max_length=32, choices=ServiceType.choices)
    status = models.CharField(
        max_length=16,
        choices=ServiceStatus.choices,
        default=ServiceStatus.ACTIVE,
        db_default=ServiceStatus.ACTIVE,
    )
    created_at = models.DateTimeField(db_default=Now())
    updated_at = models.DateTimeField(auto_now=True, db_default=Now())

    class Meta:
        db_table = "services"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                F("customer"), Lower("name"), name="services_customer_name_ci_unique"
            ),
            models.CheckConstraint(
                condition=Q(service_type__in=ServiceType.values), name="services_type_valid"
            ),
            models.CheckConstraint(
                condition=Q(status__in=ServiceStatus.values), name="services_status_valid"
            ),
        ]
        indexes = [
            models.Index(F("customer"), F("created_at").desc(), name="services_cust_created_idx"),
            models.Index(fields=["status"], name="services_status_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_service_type_display()})"


class ServiceStatusLog(models.Model):
    """Audit trail: one row per successful status transition, written in the same transaction."""

    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="status_logs")
    from_status = models.CharField(max_length=16, choices=ServiceStatus.choices)
    to_status = models.CharField(max_length=16, choices=ServiceStatus.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    source = models.CharField(max_length=16, choices=StatusChangeSource.choices)
    reason = models.CharField(max_length=500, blank=True, default="", db_default="")
    created_at = models.DateTimeField(db_default=Now())

    class Meta:
        db_table = "service_status_logs"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(from_status__in=ServiceStatus.values), name="status_logs_from_valid"
            ),
            models.CheckConstraint(
                condition=Q(to_status__in=ServiceStatus.values), name="status_logs_to_valid"
            ),
            models.CheckConstraint(
                condition=Q(source__in=StatusChangeSource.values), name="status_logs_source_valid"
            ),
        ]
        indexes = [
            models.Index(F("service"), F("created_at").desc(), name="status_logs_svc_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.service_id}: {self.from_status} → {self.to_status}"
