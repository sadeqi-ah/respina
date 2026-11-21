from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Lower, Now, Trim


def _trimmed_non_empty(field: str) -> Q:
    return ~Q(**{field: ""}) & Q(**{field: Trim(F(field))})


class Customer(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=254)
    phone = models.CharField(max_length=20, unique=True, help_text="E.164, e.g. +989121234567")
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="customer",
    )
    created_at = models.DateTimeField(db_default=Now(), db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_default=Now())

    class Meta:
        db_table = "customers"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(Lower("email"), name="customers_email_ci_unique"),
            models.CheckConstraint(
                condition=_trimmed_non_empty("first_name"), name="customers_first_name_trimmed"
            ),
            models.CheckConstraint(
                condition=_trimmed_non_empty("last_name"), name="customers_last_name_trimmed"
            ),
            models.CheckConstraint(
                condition=Q(phone__regex=r"^\+[1-9][0-9]{6,14}$"), name="customers_phone_e164"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.full_name} <{self.email}>"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
