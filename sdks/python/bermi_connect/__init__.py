"""Bermi Connect - bulk SMS, OTP and campaigns for Tanzania."""
from .client import BermiConnect, verify_signature, normalize_phone, count_segments, VERSION, DEFAULT_BASE_URL
from .errors import (
    BermiError, ValidationError, AuthenticationError, InsufficientBalanceError, ForbiddenError,
    NotFoundError, ConflictError, SenderNotApprovedError, RateLimitError, ApiError, ConnectionError,
)

__version__ = VERSION
__all__ = [
    "BermiConnect", "verify_signature", "normalize_phone", "count_segments", "VERSION", "DEFAULT_BASE_URL",
    "BermiError", "ValidationError", "AuthenticationError", "InsufficientBalanceError", "ForbiddenError",
    "NotFoundError", "ConflictError", "SenderNotApprovedError", "RateLimitError", "ApiError", "ConnectionError",
]
