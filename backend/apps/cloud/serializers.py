from django.db import transaction
from rest_framework import serializers

from .models import Service, ServiceStatus, ServiceStatusLog


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


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ServiceStatus.choices)
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class ServiceStatusLogSerializer(serializers.ModelSerializer):
    changed_by_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = ServiceStatusLog
        fields = [
            "id",
            "from_status",
            "to_status",
            "changed_by_id",
            "source",
            "reason",
            "created_at",
        ]
        read_only_fields = fields
