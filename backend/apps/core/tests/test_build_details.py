from rest_framework.exceptions import ValidationError

from apps.core.exceptions import _build_details


def details_for(detail):
    exc = ValidationError(detail)
    return _build_details(exc.detail, exc.get_codes())


def test_nested_serializer_errors_use_dotted_keys():
    from rest_framework.exceptions import ErrorDetail

    result = details_for({"address": {"city": [ErrorDetail("Required.", code="required")]}})
    assert result == {"address.city": [{"code": "required", "message": "Required."}]}


def test_list_serializer_rows_are_indexed_and_valid_rows_skipped():
    from rest_framework.exceptions import ErrorDetail

    result = details_for({"items": [{}, {"name": [ErrorDetail("Too long.", code="max_length")]}]})
    assert result == {"items.1.name": [{"code": "max_length", "message": "Too long."}]}


def test_bare_message_goes_to_non_field_errors():
    assert details_for("Nope.") == {"non_field_errors": [{"code": "invalid", "message": "Nope."}]}
