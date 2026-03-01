"""
Exceptions for Mangrove Markets SDK.
"""


class MangroveClientError(Exception):
    """Base exception for Mangrove Markets client."""
    pass


class ApiError(MangroveClientError):
    """API error (non-2xx response)."""
    def __init__(self, message: str, status_code: int = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class AuthenticationError(ApiError):
    """Authentication failed (401)."""
    pass


class ValidationError(ApiError):
    """Request validation failed (422)."""
    pass


class RateLimitError(ApiError):
    """Rate limit exceeded (429)."""
    pass


class NetworkError(MangroveClientError):
    """Network connectivity error."""
    pass
