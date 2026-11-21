"""Domain exceptions. They don't depend on DRF; apps.core.exceptions maps them to HTTP."""


class DomainError(Exception):
    code = "domain_error"
    default_message = "The request could not be completed."

    def __init__(self, message: str | None = None):
        self.message = message or self.default_message
        super().__init__(self.message)


class InvalidStatusTransition(DomainError):
    code = "invalid_status_transition"
    default_message = "This status change is not allowed."
