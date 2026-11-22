"""drf-spectacular postprocessing: registers the shared ErrorEnvelope component and
documents the common error responses on every operation."""

ERROR_ENVELOPE = {
    "type": "object",
    "required": ["error"],
    "properties": {
        "error": {
            "type": "object",
            "required": ["code", "message", "request_id"],
            "properties": {
                "code": {"type": "string", "example": "validation_error"},
                "message": {"type": "string", "example": "Invalid input."},
                "details": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "code": {"type": "string", "example": "unique"},
                                "message": {"type": "string"},
                            },
                        },
                    },
                },
                "request_id": {"type": "string", "nullable": True},
            },
        }
    },
}

_COMMON = {
    "400": "Validation error",
    "401": "Not authenticated or token invalid",
    "403": "Permission denied",
    "404": "Not found (or not visible to the caller)",
    "500": "Internal error",
}


def add_error_envelope(result, generator, request, public):
    result.setdefault("components", {}).setdefault("schemas", {})["ErrorEnvelope"] = ERROR_ENVELOPE
    ref = {"$ref": "#/components/schemas/ErrorEnvelope"}
    for path_item in result.get("paths", {}).values():
        for operation in path_item.values():
            responses = operation.setdefault("responses", {})
            for code, description in _COMMON.items():
                responses.setdefault(
                    code,
                    {"description": description, "content": {"application/json": {"schema": ref}}},
                )
    return result
