"""Mangrove Markets Python SDK.

Quickstart:
    from mangrovemarkets import MangroveClient
    
    client = MangroveClient(base_url="http://localhost:8080")
    health = client.health()
    print(health)
"""
from .client import MangroveClient, create_client
from .models import (
    HealthStatus,
    MarketplaceListing,
    DexQuote,
    WalletBalance,
)
from .exceptions import (
    MangroveClientError,
    ApiError,
    AuthenticationError,
    ValidationError,
    RateLimitError,
    NetworkError,
)

__version__ = "0.1.0"

__all__ = [
    # Client
    "MangroveClient",
    "create_client",
    # Models
    "HealthStatus",
    "MarketplaceListing",
    "DexQuote",
    "WalletBalance",
    # Exceptions
    "MangroveClientError",
    "ApiError",
    "AuthenticationError",
    "ValidationError",
    "RateLimitError",
    "NetworkError",
]
