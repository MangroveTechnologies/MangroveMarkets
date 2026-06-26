"""MangroveMarkets Python SDK.

Quickstart:
    from mangrove_markets import MangroveMarkets

    client = MangroveMarkets(base_url="http://localhost:8080")
    venues = client.dex.supported_venues()
"""

from ._client import MangroveMarkets
from ._version import __version__
from .cex import CexError, CredentialsRequiredError, KrakenClient
from .exceptions import (
    APIError,
    AuthenticationError,
    ConfigurationError,
    ConnectionError,
    MangroveError,
    NotFoundError,
    NotImplementedOnServer,
    RateLimitError,
    ServerError,
    TimeoutError,
    ValidationError,
)

__all__ = [
    "__version__",
    "MangroveMarkets",
    "KrakenClient",
    "CexError",
    "CredentialsRequiredError",
    "MangroveError",
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
