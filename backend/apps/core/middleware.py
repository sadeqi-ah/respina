import re
import uuid

from .request_context import request_id_var

HEADER = "X-Request-ID"
# Accept caller-supplied IDs only if they are short and harmless (no log injection).
_VALID_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


class RequestIDMiddleware:
    """Reads X-Request-ID (or generates a UUID4), exposes it to logs and echoes it back."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.headers.get(HEADER, "")
        request_id = incoming if _VALID_ID.match(incoming) else uuid.uuid4().hex
        request.request_id = request_id
        token = request_id_var.set(request_id)
        try:
            response = self.get_response(request)
        finally:
            request_id_var.reset(token)
        response[HEADER] = request_id
        return response
