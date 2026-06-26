"""Client-side CEX errors for the Kraken BYOK module.

These are produced **client-side** by ``KrakenClient`` / the SDK. They mirror
the structured error codes from the (now-removed) server CEX implementation so
agents that previously consumed ``cex_*`` tool errors keep the same contract:

    { "error": true, "code": "ERROR_CODE", "message": "...", "suggestion": "..." }

The full enumeration lives in the CEX-BYOK specification (see
``docs/features/cex-byok/specification.md`` in MangroveMarkets-MCP-Server).
"""
from __future__ import annotations


class CexError(Exception):
    """Base error for CEX operations.

    Carries a machine-readable ``code``, a human/agent-readable ``message``,
    and an actionable ``suggestion`` so callers can recover programmatically.
    """

    def __init__(self, code: str, message: str, suggestion: str = "") -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.suggestion = suggestion

    def to_dict(self) -> dict[str, object]:
        """Serialize to the structured error envelope agents expect."""
        return {
            "error": True,
            "code": self.code,
            "message": self.message,
            "suggestion": self.suggestion,
        }

    def __str__(self) -> str:
        base = f"{self.code}: {self.message}"
        if self.suggestion:
            base += f" (suggestion: {self.suggestion})"
        return base


class CredentialsRequiredError(CexError):
    """Raised when a ``KrakenClient`` is constructed without an API key/secret.

    The BYOK contract: the SDK cannot be constructed — and therefore no CEX
    method can run — without the user's own Kraken credentials.
    """

    def __init__(
        self,
        message: str = "Kraken API key and secret are required",
    ) -> None:
        super().__init__(
            "CEX_CREDENTIALS_REQUIRED",
            message,
            "Supply your own Kraken API key in local config / the KrakenClient "
            "constructor. The key never leaves your machine.",
        )


class InvalidCredentialsError(CexError):
    """Raised when Kraken rejects the key/signature (wrong or revoked key)."""

    def __init__(self, message: str = "Invalid Kraken credentials") -> None:
        super().__init__(
            "CEX_INVALID_CREDENTIALS",
            message,
            "Verify your Kraken API key and secret are correct and not revoked.",
        )


class PermissionDeniedError(CexError):
    """Raised when the key lacks the permission/scope for the action."""

    def __init__(self, message: str = "Permission denied by Kraken") -> None:
        super().__init__(
            "CEX_PERMISSION_DENIED",
            message,
            "Verify the Kraken API key has the required permissions enabled.",
        )


class OrderMinNotMetError(CexError):
    """Raised when the order volume is below the pair's ``ordermin``."""

    def __init__(self, pair: str = "", order_min: str = "") -> None:
        where = f" for '{pair}'" if pair else ""
        detail = f" (minimum: {order_min})" if order_min else ""
        super().__init__(
            "CEX_ORDER_MIN_NOT_MET",
            f"Order volume below minimum{where}{detail}",
            "Increase the order volume to meet the pair's minimum.",
        )


class CostMinNotMetError(CexError):
    """Raised when the order cost is below the pair's ``costmin``."""

    def __init__(self, pair: str = "", cost_min: str = "") -> None:
        where = f" for '{pair}'" if pair else ""
        detail = f" (minimum: {cost_min})" if cost_min else ""
        super().__init__(
            "CEX_COST_MIN_NOT_MET",
            f"Order cost below minimum{where}{detail}",
            "Increase the volume or price so the total cost meets the minimum.",
        )


class TickSizeInvalidError(CexError):
    """Raised when the order price is not a multiple of the pair's tick size."""

    def __init__(self, pair: str = "", tick_size: str = "") -> None:
        where = f" for '{pair}'" if pair else ""
        detail = f" (tick size: {tick_size})" if tick_size else ""
        super().__init__(
            "CEX_TICK_SIZE_INVALID",
            f"Price is not aligned to the tick size{where}{detail}",
            "Round the price to a multiple of the pair's tick size.",
        )


class InsufficientBalanceError(CexError):
    """Raised when the account does not have enough funds for the action."""

    def __init__(self, message: str = "Insufficient balance") -> None:
        super().__init__(
            "CEX_INSUFFICIENT_BALANCE",
            message,
            "Fund the account or reduce the order size.",
        )


class ValidationFailedError(CexError):
    """Raised when Kraken's dry-run validation rejects an order."""

    def __init__(self, reason: str = "Order validation failed") -> None:
        super().__init__(
            "CEX_VALIDATION_FAILED",
            reason,
            "Check the order parameters against the pair metadata and try again.",
        )


class PairNotFoundError(CexError):
    """Raised when the requested trading pair is unknown to Kraken."""

    def __init__(self, pair: str = "") -> None:
        where = f" '{pair}'" if pair else ""
        super().__init__(
            "CEX_PAIR_NOT_FOUND",
            f"Pair{where} not found",
            "Use get_asset_pairs() to see available pairs.",
        )


class RateLimitedError(CexError):
    """Raised when Kraken's rate limit is hit after client backoff/retry."""

    def __init__(self, message: str = "Kraken rate limit exceeded") -> None:
        super().__init__(
            "CEX_RATE_LIMITED",
            message,
            "Back off and retry after a short delay.",
        )


class VenueUnavailableError(CexError):
    """Raised when Kraken is unreachable or in maintenance."""

    def __init__(self, message: str = "Kraken is currently unavailable") -> None:
        super().__init__(
            "CEX_VENUE_UNAVAILABLE",
            message,
            "Check Kraken's status page and try again later.",
        )


class InvalidNonceError(CexError):
    """Raised on a persistent nonce error (usually client clock skew)."""

    def __init__(self, message: str = "Invalid nonce") -> None:
        super().__init__(
            "CEX_INVALID_NONCE",
            message,
            "The client retries once with a fresh nonce; if this persists, "
            "check your machine's clock.",
        )


class UnknownCexError(CexError):
    """Fallback for Kraken errors that are not explicitly mapped."""

    def __init__(self, message: str = "Unknown CEX error") -> None:
        super().__init__(
            "CEX_UNKNOWN",
            message,
            "Check Kraken's status page or retry the request.",
        )
