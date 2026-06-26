"""Client-side CEX (Kraken) module — bring your own key.

The user supplies their **own** Kraken API key/secret. The SDK signs locally
(HMAC-SHA512) and calls ``api.kraken.com`` directly; the key never reaches any
Mangrove service. Construction without credentials raises
``CredentialsRequiredError`` — every CEX method is gated on the key.

Usage::

    from mangrove_markets.cex import KrakenClient

    kraken = KrakenClient(api_key="...", api_secret="...")
    balance = kraken.get_balance()
    ticker = kraken.get_ticker("XBTUSD")

The same client is reachable from the main SDK client as ``client.cex(...)``.
"""
from __future__ import annotations

from .client import KrakenApiError, KrakenHttpClient
from .error_mapping import map_error, translate
from .errors import (
    CexError,
    CostMinNotMetError,
    CredentialsRequiredError,
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
from .kraken import KrakenClient
from .models import (
    AccountBalance,
    AssetBalance,
    AssetInfo,
    CloseOrder,
    OhlcCandle,
    OhlcSeries,
    OrderBook,
    OrderBookLevel,
    OrderDetail,
    OrderReceipt,
    OrderRequest,
    OrderSide,
    OrderStatus,
    OrderType,
    PairFeeInfo,
    PairInfo,
    PublicTrade,
    RecentTrades,
    Ticker,
    TimeInForce,
    TradeBalance,
    TradeDetail,
    TradeVolumeInfo,
    VenueStatus,
)

__all__ = [
    # Clients
    "KrakenClient",
    "KrakenHttpClient",
    "KrakenApiError",
    # Errors
    "CexError",
    "CredentialsRequiredError",
    "InvalidCredentialsError",
    "PermissionDeniedError",
    "OrderMinNotMetError",
    "CostMinNotMetError",
    "TickSizeInvalidError",
    "InsufficientBalanceError",
    "ValidationFailedError",
    "PairNotFoundError",
    "RateLimitedError",
    "VenueUnavailableError",
    "InvalidNonceError",
    "UnknownCexError",
    "map_error",
    "translate",
    # Models
    "OrderType",
    "OrderSide",
    "TimeInForce",
    "OrderStatus",
    "AssetInfo",
    "PairInfo",
    "AssetBalance",
    "AccountBalance",
    "TradeBalance",
    "CloseOrder",
    "OrderRequest",
    "OrderReceipt",
    "OrderDetail",
    "TradeDetail",
    "PairFeeInfo",
    "TradeVolumeInfo",
    "Ticker",
    "OhlcCandle",
    "OhlcSeries",
    "OrderBookLevel",
    "OrderBook",
    "PublicTrade",
    "RecentTrades",
    "VenueStatus",
]
