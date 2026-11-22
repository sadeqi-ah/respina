"""Test-only views that raise each mapped error type."""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.db import IntegrityError
from django.http import Http404
from django.urls import path
from rest_framework import exceptions, serializers
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.validators import UniqueValidator
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.cloud.models import Service
from apps.core.errors import InvalidStatusTransition
from apps.customers.models import Customer


class CustomerInput(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    email = serializers.EmailField(
        validators=[
            UniqueValidator(
                queryset=Customer.objects.all(),
                lookup="iexact",
                message="A customer with this email already exists.",
            )
        ]
    )

    def validate(self, attrs):
        if attrs["first_name"] == "reject":
            raise serializers.ValidationError("Rejected by an object-level rule.")
        return attrs


def raising(factory):
    class View(APIView):
        permission_classes = [AllowAny]

        def get(self, request):
            raise factory()

    return View.as_view()


class ValidateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        CustomerInput(data=request.data).is_valid(raise_exception=True)
        return Response(status=204)


class ProtectedView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        Service.objects.get(pk=int(request.query_params["id"])).customer.delete()
        return Response()


class UniqueRaceView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        existing = Customer.objects.get()
        # Skips serializer validation, as a concurrent insert would.
        Customer.objects.create(
            first_name="X", last_name="Y", email=existing.email.upper(), phone="+989120000999"
        )
        return Response()


class GetOnlyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({})


class UserList(ListAPIView):
    permission_classes = [AllowAny]
    queryset = User.objects.order_by("id")

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response([{"id": u.id} for u in page])


class AuthRequiredView(APIView):
    def get(self, request):
        return Response({})


urlpatterns = [
    path("validate", ValidateView.as_view()),
    path("http404", raising(Http404)),
    path("not-found", raising(exceptions.NotFound)),
    path("django-forbidden", raising(DjangoPermissionDenied)),
    path("forbidden", raising(exceptions.PermissionDenied)),
    path("transition", raising(lambda: InvalidStatusTransition("Already active."))),
    path("integrity-other", raising(lambda: IntegrityError("check violated"))),
    path("boom", raising(lambda: RuntimeError("secret internals"))),
    path("throttled", raising(lambda: exceptions.Throttled(wait=30))),
    path("protected", ProtectedView.as_view()),
    path("unique-race", UniqueRaceView.as_view()),
    path("get-only", GetOnlyView.as_view()),
    path("users", UserList.as_view()),
    path("auth-required", AuthRequiredView.as_view()),
]

handler404 = "apps.core.views.not_found"
