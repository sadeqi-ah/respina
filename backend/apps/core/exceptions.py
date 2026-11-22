"""DRF exception handler: every non-2xx response uses the error envelope (plan §3.4).

{"error": {"code": ..., "message": ..., "details": {...}, "request_id": ...}}

`message` is always English; clients translate by `code`.
"""

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.db import IntegrityError
from django.db.models import ProtectedError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .errors import DomainError, InvalidStatusTransition, ServiceBusy
from .request_context import get_request_id

logger = logging.getLogger(__name__)

UNIQUE_VIOLATION = "23505"


class Conflict(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The request conflicts with the current state of the resource."
    default_code = "conflict"


class InvalidStatusTransitionError(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = InvalidStatusTransition.default_message
    default_code = InvalidStatusTransition.code


class ServiceBusyError(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = ServiceBusy.default_message
    default_code = ServiceBusy.code


# Stable public codes per DRF exception type. Order matters: subclasses first.
_CODES: list[tuple[type[exceptions.APIException], str]] = [
    (exceptions.ValidationError, "validation_error"),
    (exceptions.NotAuthenticated, "not_authenticated"),
    (exceptions.AuthenticationFailed, "token_invalid"),
    (exceptions.PermissionDenied, "permission_denied"),
    (exceptions.NotFound, "not_found"),
    (exceptions.MethodNotAllowed, "method_not_allowed"),
    (exceptions.Throttled, "throttled"),
]

_MESSAGES = {
    "validation_error": "Invalid input.",
    "not_authenticated": "Authentication credentials were not provided.",
    "token_invalid": "The token is invalid or expired.",
    "invalid_credentials": "No active account found with the given credentials.",
    "permission_denied": "You do not have permission to perform this action.",
    "not_found": "Not found.",
    "internal_error": "An unexpected error occurred.",
}


def _is_unique_violation(exc: IntegrityError) -> bool:
    return getattr(exc.__cause__, "sqlstate", None) == UNIQUE_VIOLATION


def _translate(exc: Exception) -> Exception:
    """Convert Django / domain exceptions into DRF exceptions with the right status."""
    if isinstance(exc, Http404):
        return exceptions.NotFound()
    if isinstance(exc, DjangoPermissionDenied):
        return exceptions.PermissionDenied()
    if isinstance(exc, ProtectedError):
        return Conflict("This resource is still referenced by other records.")
    if isinstance(exc, IntegrityError) and _is_unique_violation(exc):
        return Conflict("A resource with these values already exists.")
    if isinstance(exc, InvalidStatusTransition):
        return InvalidStatusTransitionError(exc.message)
    if isinstance(exc, ServiceBusy):
        return ServiceBusyError(exc.message)
    if isinstance(exc, DomainError):
        return Conflict(exc.message)
    return exc


def _public_code(exc: exceptions.APIException) -> str:
    if isinstance(exc, exceptions.AuthenticationFailed):
        # simplejwt uses this code for a wrong email/password on the token endpoint.
        codes = exc.get_codes()
        if codes == "no_active_account" or (
            isinstance(codes, dict) and codes.get("detail") == "no_active_account"
        ):
            return "invalid_credentials"
    for exc_type, code in _CODES:
        if isinstance(exc, exc_type):
            return code
    return exc.default_code


def _build_details(detail, codes) -> dict[str, list[dict[str, str]]]:
    """Turn a ValidationError's `detail` + `get_codes()` into {field: [{code, message}]}.

    Examples of the inputs DRF produces:
      detail={"email": [ErrorDetail("A customer ...", code="unique")]}
      codes ={"email": ["unique"]}
      detail=[ErrorDetail("Bad combination.", code="invalid")]  (serializer-level error)
      detail={"address": {"city": [ErrorDetail(...)]}}            (nested serializer)
    """
    details: dict[str, list[dict[str, str]]] = {}
    _collect_details(detail, codes, "", details)
    return details


def _collect_details(detail, codes, path: str, out: dict[str, list[dict[str, str]]]) -> None:
    """Walk `detail` and `codes` in parallel (they share one shape), flattening to dotted keys.

    Nested serializer fields become `address.city`; rows of a list serializer become
    `items.0.name`. Errors with no field (a bare list at the top level) go under
    `non_field_errors`, the same key DRF uses for serializer-level errors.
    """
    if isinstance(detail, dict):
        for key, value in detail.items():
            child = f"{path}.{key}" if path else str(key)
            _collect_details(value, codes[key], child, out)
    elif isinstance(detail, list):
        for index, (item, item_code) in enumerate(zip(detail, codes, strict=True)):
            if isinstance(item, dict | list):
                child = f"{path}.{index}" if path else str(index)
                _collect_details(item, item_code, child, out)
            else:
                _append_detail(out, path, item, item_code)
    else:
        _append_detail(out, path, detail, codes)


def _append_detail(out: dict[str, list[dict[str, str]]], path: str, message, code) -> None:
    out.setdefault(path or "non_field_errors", []).append(
        {"code": str(code), "message": str(message)}
    )


def _envelope(code: str, message: str, details: dict | None = None) -> dict:
    error: dict = {"code": code, "message": message}
    if details:
        error["details"] = details
    error["request_id"] = get_request_id()
    return {"error": error}


def exception_handler(exc: Exception, context: dict) -> Response:
    exc = _translate(exc)
    # DRF's handler sets status and headers (WWW-Authenticate, Allow, Retry-After).
    response = drf_exception_handler(exc, context)

    if response is None:
        logger.exception("Unhandled exception", exc_info=exc)
        return Response(
            _envelope("internal_error", _MESSAGES["internal_error"]),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = _public_code(exc)
    if isinstance(exc, exceptions.ValidationError):
        details = _build_details(exc.detail, exc.get_codes())
        response.data = _envelope(code, _MESSAGES["validation_error"], details)
    else:
        message = _MESSAGES.get(code) or str(exc.detail)
        response.data = _envelope(code, message)
    return response
