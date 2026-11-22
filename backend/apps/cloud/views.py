from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsStaffRole

from .models import StatusChangeSource
from .selectors import status_history_for, visible_services_for
from .serializers import ServiceSerializer, ServiceStatusLogSerializer, StatusChangeSerializer
from .use_cases import change_service_status


class ServiceViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ServiceSerializer

    def get_queryset(self):
        return visible_services_for(self.request.user)

    def get_permissions(self):
        if self.action == "change_status":
            return [IsStaffRole()]
        return [IsAuthenticated()]

    @extend_schema(
        summary="Change a service's status (staff only)",
        request=StatusChangeSerializer,
        responses={200: ServiceSerializer},
    )
    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        payload = StatusChangeSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        service = change_service_status(
            service_id=self.kwargs["pk"],
            target_status=payload.validated_data["status"],
            actor=request.user,
            reason=payload.validated_data["reason"],
            source=StatusChangeSource.API,
        )
        return Response(ServiceSerializer(service).data)

    @extend_schema(
        summary="A service's status history, newest first",
        responses=ServiceStatusLogSerializer(many=True),
    )
    @action(detail=True, methods=["get"], url_path="status-history")
    def status_history(self, request, pk=None):
        service = self.get_object()  # 404 if not visible to the caller
        page = self.paginate_queryset(status_history_for(request.user, service.id))
        return self.get_paginated_response(ServiceStatusLogSerializer(page, many=True).data)
