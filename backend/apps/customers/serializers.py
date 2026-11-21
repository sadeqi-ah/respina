from django.db import transaction
from rest_framework import serializers

from apps.cloud.models import Service

from .models import Customer
from .validators import normalize_phone


class CustomerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    services_count = serializers.IntegerField(read_only=True)
    # Explicit fields: the model's DB-level constraints don't translate into DRF validators.
    first_name = serializers.CharField(max_length=100, trim_whitespace=True)
    last_name = serializers.CharField(max_length=100, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=32)

    class Meta:
        model = Customer
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "services_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if Customer.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                "A customer with this email already exists.", code="unique"
            )
        return email

    def validate_phone(self, value: str) -> str:
        phone = normalize_phone(value)
        if Customer.objects.filter(phone=phone).exists():
            raise serializers.ValidationError(
                "A customer with this phone number already exists.", code="unique"
            )
        return phone

    def create(self, validated_data) -> Customer:
        # A concurrent insert can still pass the checks above; the DB unique constraint then
        # raises IntegrityError, which the exception handler maps to 409 `conflict`.
        with transaction.atomic():
            customer = super().create(validated_data)
        customer.services_count = 0
        return customer


class ServiceSerializer(serializers.ModelSerializer):
    customer_id = serializers.IntegerField(read_only=True)
    service_type_display = serializers.CharField(source="get_service_type_display", read_only=True)
    name = serializers.CharField(max_length=100, trim_whitespace=True)

    class Meta:
        model = Service
        fields = [
            "id",
            "customer_id",
            "name",
            "service_type",
            "service_type_display",
            "status",
            "created_at",
            "updated_at",
        ]
        # New services always start `active`; status changes go through the transition endpoint.
        read_only_fields = ["id", "status", "created_at", "updated_at"]

    def validate_name(self, value: str) -> str:
        customer = self.context["customer"]
        if Service.objects.filter(customer=customer, name__iexact=value).exists():
            raise serializers.ValidationError(
                "This customer already has a service with this name.", code="unique"
            )
        return value

    def create(self, validated_data) -> Service:
        with transaction.atomic():
            return Service.objects.create(customer=self.context["customer"], **validated_data)
