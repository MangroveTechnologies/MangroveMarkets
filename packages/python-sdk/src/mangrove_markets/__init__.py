"""MangroveMarkets Python SDK.

Quickstart:
    from mangrove_markets import MangroveMarkets

    client = MangroveMarkets(base_url="http://localhost:8080")
    venues = client.dex.supported_venues()
"""

from ._client import MangroveMarkets
from ._kraken import KrakenClient, KrakenError
from ._version import __version__
from .exceptions import (
    APIError,
    AuthenticationError,
    ConfigurationError,
    ConnectionError,
    MalformedResponseError,
    MangroveError,
    NotFoundError,
    NotImplementedOnServer,
    RateLimitError,
    ServerError,
    TimeoutError,
    ValidationError,
)
from .models.telemetry import TradeRecord
from .results import ToolResponse, ToolResult

__all__ = [
    "__version__",
    "MangroveMarkets",
    "KrakenClient",
    "KrakenError",
    "TradeRecord",
    "MangroveError",
    "MalformedResponseError",
    "ToolResponse",
    "ToolResult",
    "APIError",
    "AuthenticationError",
    "ConfigurationError",
    "ConnectionError",
    "NotFoundError",
    "NotImplementedOnServer",
    "RateLimitError",
    "ServerError",
    "TimeoutError",
    "ValidationError",
]
