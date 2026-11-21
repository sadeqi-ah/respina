"""Phone input parsing at the API boundary (plan §3.4: stored as E.164, default region IR)."""

import phonenumbers
from rest_framework.exceptions import ValidationError

DEFAULT_REGION = "IR"
INVALID_PHONE_MESSAGE = "Enter a valid phone number, e.g. 09121234567 or +989121234567."


def normalize_phone(raw: str) -> str:
    """Return `raw` as E.164 (e.g. "+989121234567").

    Accepts "09121234567", "+989121234567" and "00989121234567" (plus common separators).
    Raises ValidationError(INVALID_PHONE_MESSAGE, code="invalid_phone") for anything else.
    """
    try:
        number = phonenumbers.parse(raw, DEFAULT_REGION)
    except phonenumbers.NumberParseException:
        raise ValidationError(INVALID_PHONE_MESSAGE, code="invalid_phone") from None

    # is_valid_number checks real numbering ranges, not just length. Any region and any
    # number type (mobile/landline) is accepted.
    if not phonenumbers.is_valid_number(number):
        raise ValidationError(INVALID_PHONE_MESSAGE, code="invalid_phone")

    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)
