"""Typed exceptions raised by the Bermi Connect client."""
from typing import Any, Optional


class BermiError(Exception):
    """Base class for every SDK error."""

    def __init__(self, message: str, code: str = "api_error", status: int = 0, details: Any = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.details = details

    def __repr__(self) -> str:
        return f"{type(self).__name__}(code={self.code!r}, status={self.status}, message={self.message!r})"


class ValidationError(BermiError): pass
class AuthenticationError(BermiError): pass
class InsufficientBalanceError(BermiError): pass
class ForbiddenError(BermiError): pass
class NotFoundError(BermiError): pass
class ConflictError(BermiError): pass
class SenderNotApprovedError(BermiError): pass
class ApiError(BermiError): pass
class ConnectionError(BermiError): pass  # noqa: A001 - shadows builtin intentionally inside namespace


class RateLimitError(BermiError):
    def __init__(self, message: str, code: str = "rate_limited", status: int = 429, details: Any = None,
                 retry_after: Optional[float] = None):
        super().__init__(message, code, status, details)
        self.retry_after = retry_after


BY_CODE = {
    "validation_error": ValidationError,
    "unauthorized": AuthenticationError,
    "insufficient_balance": InsufficientBalanceError,
    "forbidden": ForbiddenError,
    "not_found": NotFoundError,
    "conflict": ConflictError,
    "sender_not_approved": SenderNotApprovedError,
    "rate_limited": RateLimitError,
}
BY_STATUS = {
    400: ValidationError, 401: AuthenticationError, 402: InsufficientBalanceError, 403: ForbiddenError,
    404: NotFoundError, 409: ConflictError, 422: SenderNotApprovedError, 429: RateLimitError,
}
