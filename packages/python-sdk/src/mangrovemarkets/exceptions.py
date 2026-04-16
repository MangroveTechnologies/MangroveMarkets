from __future__ import annotations


class MangroveError(Exception):
    """Base exception for all MangroveMarkets SDK errors."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class APIError(MangroveError):
    """Server returned a non-2xx response."""

    def __init__(
        self,
        status_code: int,
        error: str,
        message: str,
        code: str,
        suggestion: str | None = None,
    ) -> None:
        self.status_code = status_code
        self.error = error
        self.code = code
        self.suggestion = suggestion
        super().__init__(message)

    def __str__(self) -> str:
        base = f"[{self.status_code}] {self.code}: {self.message}"
        if self.suggestion:
            base += f" (suggestion: {self.suggestion})"
        return base


class AuthenticationError(APIError):
    """401 Unauthorized."""


class ValidationError(APIError):
    """422 Unprocessable Entity."""


class NotFoundError(APIError):
    """404 Not Found."""


class RateLimitError(APIError):
    """429 Too Many Requests."""


class ServerError(APIError):
    """5xx Server Error."""


class ConnectionError(MangroveError):
    """Network-level connection failure."""


class TimeoutError(MangroveError):
    """Request timeout."""


class ConfigurationError(MangroveError):
    """Invalid SDK configuration."""


class NotImplementedOnServer(MangroveError):
    """Server tool exists but is not yet implemented (returns NOT_IMPLEMENTED)."""


STATUS_CODE_EXCEPTIONS: dict[int, type[APIError]] = {
    401: AuthenticationError,
    404: NotFoundError,
    422: ValidationError,
    429: RateLimitError,
}
