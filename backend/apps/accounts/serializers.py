from rest_framework import serializers
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer as BaseTokenObtainPairSerializer,
)

from .models import User


def customer_id_for(user: User) -> int | None:
    """The customer record linked to this login, if any (one login per customer)."""
    from apps.customers.models import Customer

    return Customer.objects.filter(user=user).values_list("id", flat=True).first()


class TokenObtainPairSerializer(BaseTokenObtainPairSerializer):
    """Adds `role` and `customer_id` claims. Refreshed access tokens inherit them."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["customer_id"] = customer_id_for(user)
        return token


class MeSerializer(serializers.ModelSerializer):
    customer_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "role", "customer_id"]
        read_only_fields = fields

    def get_customer_id(self, user) -> int | None:
        return customer_id_for(user)
