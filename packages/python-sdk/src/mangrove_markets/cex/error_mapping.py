"""Translate raw Kraken error strings into structured ``CexError`` codes.

Ported from the server's ``src/cex/adapters/kraken.py`` (``_map_error`` /
``_translate``). Produced **client-side** now — the SDK maps Kraken's error
strings into the same structured codes agents already consume.
"""
from __future__ import annotations

from .client import KrakenApiError
from .errors import (
    CexError,
    CostMinNotMetError,
    InsufficientBalanceError,
    InvalidCredentialsError,
    InvalidNonceError,
    OrderMinNotMetError,
    PairNotFoundError,
    PermissionDeniedError,
    RateLimitedError,
    TickSizeInvalidError,
    UnknownCexError,
    ValidationFailedError,
    VenueUnavailableError,
)


def map_error(kraken_error_str: str) -> CexError:
    """Translate a single Kraken error string into the right CexError subclass.

    Substring match; first match wins. Unknowns fall through to
    ``CEX_UNKNOWN`` with the raw message.
    """
    err = kraken_error_str or ""

    # Auth — wrong/revoked key or bad signature is an invalid-credentials case
    # (BYOK: the user supplied the key, so the actionable advice is "check your key").
    if "EAPI:Invalid key" in err or "EAPI:Invalid signature" in err:
        return InvalidCredentialsError(err)
    if "EGeneral:Permission denied" in err:
        return PermissionDeniedError(err)

    # Nonce
    if "EAPI:Invalid nonce" in err:
        return InvalidNonceError(err)

    # Rate limits — check before generic service errors
    if (
        "EAPI:Rate limit exceeded" in err
        or "EOrder:Rate limit exceeded" in err
        or "EOrder:Domain rate limit exceeded" in err
    ):
        return RateLimitedError(err)

    # Service unavailability
    if (
        "EService:Unavailable" in err
        or "EService:Busy" in err
        or "EService:Market in cancel_only mode" in err
        or "EService:Market in post_only mode" in err
    ):
        return VenueUnavailableError(err)

    # Order validation errors
    if "EOrder:Insufficient funds" in err:
        return InsufficientBalanceError(err)
    if "EOrder:Order minimum not met" in err:
        return OrderMinNotMetError("", err)
    if "EOrder:Cost minimum not met" in err:
        return CostMinNotMetError("", err)
    if "EOrder:Tick size check failed" in err:
        return TickSizeInvalidError("", err)
    if "EOrder:Invalid price" in err:
        return ValidationFailedError(err)

    # Pair / asset
    if "EQuery:Unknown asset pair" in err:
        return PairNotFoundError(err)

    return UnknownCexError(err)


def translate(exc: KrakenApiError) -> CexError:
    """Translate the first mappable Kraken error in a ``KrakenApiError``.

    If every string falls through to ``UnknownCexError``, concatenate them.
    """
    if not exc.errors:
        return UnknownCexError(str(exc))
    for raw in exc.errors:
        mapped = map_error(raw)
        if not isinstance(mapped, UnknownCexError):
            return mapped
    return UnknownCexError("; ".join(exc.errors))
