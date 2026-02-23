"""Data models for Mangrove Markets SDK."""
from dataclasses import dataclass
from typing import Optional, List, Dict, Any


@dataclass
class HealthStatus:
    """Health status response."""
    status: str
    service: str
    timestamp: str
    checks: Optional[Dict[str, Any]] = None


@dataclass
class MarketplaceListing:
    """Marketplace listing."""
    id: str
    name: str
    description: str
    category: str
    price: float
    currency: str
    seller_address: str
    status: str
    created_at: str
    updated_at: str
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class DexQuote:
    """DEX quote response."""
    from_token: str
    to_token: str
    from_amount: str
    to_amount: str
    price_impact: float
    route: List[str]
    estimated_gas: int
    expires_at: str


@dataclass
class WalletBalance:
    """Wallet balance."""
    address: str
    token: str
    balance: str
    balance_usd: Optional[float] = None


@dataclass
class Transaction:
    """Wallet transaction."""
    hash: str
    from_address: str
    to_address: str
    amount: str
    token: str
    status: str
    timestamp: str
    block_number: Optional[int] = None
