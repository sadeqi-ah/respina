import pytest
from rest_framework.exceptions import ValidationError

from apps.customers.validators import normalize_phone


@pytest.mark.parametrize(
    "raw",
    ["09121234567", "+989121234567", "00989121234567", "0912 123 4567", "0912-123-4567"],
)
def test_accepted_formats_normalize_to_e164(raw):
    assert normalize_phone(raw) == "+989121234567"


@pytest.mark.parametrize("raw", ["", "abc", "123", "0912", "+98912123456789012", "091212345678"])
def test_invalid_numbers_raise_invalid_phone(raw):
    with pytest.raises(ValidationError) as excinfo:
        normalize_phone(raw)
    assert excinfo.value.get_codes() == ["invalid_phone"]
