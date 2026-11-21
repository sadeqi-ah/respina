from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def healthz(request):
    """Liveness + DB check, used by the compose healthcheck."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


def _error(code: str, message: str, status: int, request) -> JsonResponse:
    request_id = getattr(request, "request_id", None)
    body = {"error": {"code": code, "message": message, "request_id": request_id}}
    return JsonResponse(body, status=status)


def not_found(request, exception=None):
    """Django-level 404 (unknown URL) in the standard error envelope."""
    return _error("not_found", "Not found.", 404, request)


def server_error(request):
    return _error("internal_error", "An unexpected error occurred.", 500, request)
