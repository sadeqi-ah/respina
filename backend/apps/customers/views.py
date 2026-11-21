from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ErrorDetail, ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.cloud.models import ServiceStatus, ServiceType
from apps.cloud.selectors import visible_services_for
from apps.core.permissions import IsStaffOrReadOnly

from .filters import ServiceFilter
from .selectors import visible_customers_for
from .serializers import CustomerSerializer, ServiceSerializer


def _with_codes(form_errors) -> dict[str, list[ErrorDetail]]:
    """Keep Django form error codes (e.g. `invalid_choice`) when re-raising for DRF."""
    return {
        field: [ErrorDetail(e["message"], code=e["code"]) for e in errors]
        for field, errors in form_errors.get_json_data().items()
    }


@extend_schema_view(
    list=extend_schema(summary="List customers (customers see only their own record)"),
    retrieve=extend_schema(summary="Retrieve a customer"),
    create=extend_schema(summary="Create a customer (staff only)"),
)
class CustomerViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CustomerSerializer
    permission_classes = [IsStaffOrReadOnly]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["first_name", "last_name", "email", "phone"]
    ordering_fields = ["created_at", "last_name"]
    ordering = ["-created_at", "-id"]

    def get_queryset(self):
        # Scoping lives here, not in permissions: invisible rows become 404, never 403.
        return visible_customers_for(self.request.user)

    @extend_schema(
        methods=["GET"],
        summary="List a customer's services",
        parameters=[
            OpenApiParameter("status", enum=ServiceStatus.values),
            OpenApiParameter("service_type", enum=ServiceType.values),
        ],
        responses=ServiceSerializer(many=True),
    )
    @extend_schema(
        methods=["POST"],
        summary="Create a service for a customer (staff only)",
        request=ServiceSerializer,
        responses={201: ServiceSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="services")
    def services(self, request, pk=None):
        customer = self.get_object()  # 404 if not visible to the caller

        if request.method == "POST":
            serializer = ServiceSerializer(data=request.data, context={"customer": customer})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        services = visible_services_for(request.user).filter(customer=customer)
        service_filter = ServiceFilter(request.query_params, queryset=services)
        if not service_filter.is_valid():
            raise ValidationError(_with_codes(service_filter.errors))
        page = self.paginate_queryset(service_filter.qs.order_by("-created_at", "-id"))
        return self.get_paginated_response(ServiceSerializer(page, many=True).data)
