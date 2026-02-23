"""
MCP Client for MangroveMarkets.

Provides Python client libraries for interacting with the MangroveMarkets
MCP server. Supports marketplace, DEX, wallet, and integration tools.
"""
import os
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

import httpx

from .exceptions import (
    MangroveClientError,
    ApiError,
    AuthenticationError,
    ValidationError,
)


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


class MangroveClient:
    """Main client for Mangrove Markets MCP Server.
    
    Args:
        base_url: Base URL of the MCP server (default: http://localhost:8080)
        api_key: API key for authentication
        timeout: Request timeout in seconds
    """
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: int = 30,
    ):
        self.base_url = base_url or os.getenv("MANGROVE_BASE_URL", "http://localhost:8080")
        self.api_key = api_key or os.getenv("MANGROVE_API_KEY")
        self.timeout = timeout
        
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout,
            headers=self._build_headers(),
        )
    
    def _build_headers(self) -> Dict[str, str]:
        """Build request headers."""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers
    
    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()
    
    def __enter__(self) -> "MangroveClient":
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
    
    # ==================== Health ====================
    
    def health(self, include_checks: bool = False) -> HealthStatus:
        """Get service health status."""
        response = self._client.get("/health", params={"include_checks": include_checks})
        self._handle_response(response)
        data = response.json()
        return HealthStatus(**data)
    
    def status(self) -> Dict[str, str]:
        """Get service version and status."""
        response = self._client.get("/status")
        self._handle_response(response)
        return response.json()
    
    # ==================== Marketplace ====================
    
    def list_marketplace_listings(
        self,
        category: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[MarketplaceListing]:
        """List marketplace listings."""
        params = {"limit": limit}
        if category:
            params["category"] = category
        if status:
            params["status"] = status
        
        response = self._client.get("/marketplace/listings", params=params)
        self._handle_response(response)
        data = response.json()
        
        if isinstance(data, dict) and "data" in data:
            return [MarketplaceListing(**item) for item in data["data"]]
        return [MarketplaceListing(**item) for item in data]
    
    def get_listing(self, listing_id: str) -> MarketplaceListing:
        """Get a specific listing by ID."""
        response = self._client.get(f"/marketplace/listings/{listing_id}")
        self._handle_response(response)
        return MarketplaceListing(**response.json())
    
    def create_listing(
        self,
        name: str,
        description: str,
        category: str,
        price: float,
        currency: str = "MGVI",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MarketplaceListing:
        """Create a new marketplace listing."""
        payload = {
            "name": name,
            "description": description,
            "category": category,
            "price": price,
            "currency": currency,
        }
        if metadata:
            payload["metadata"] = metadata
        
        response = self._client.post("/marketplace/listings", json=payload)
        self._handle_response(response)
        return MarketplaceListing(**response.json())
    
    # ==================== DEX ====================
    
    def get_dex_quote(
        self,
        from_token: str,
        to_token: str,
        amount: str,
        side: str = "buy",
    ) -> DexQuote:
        """Get a DEX quote for a token swap."""
        params = {
            "fromToken": from_token,
            "toToken": to_token,
            "amount": amount,
            "side": side,
        }
        response = self._client.get("/dex/quote", params=params)
        self._handle_response(response)
        return DexQuote(**response.json())
    
    def execute_swap(
        self,
        from_token: str,
        to_token: str,
        amount: str,
        side: str = "buy",
        slippage: float = 0.5,
    ) -> Dict[str, Any]:
        """Execute a token swap."""
        payload = {
            "fromToken": from_token,
            "toToken": to_token,
            "amount": amount,
            "side": side,
            "slippage": slippage,
        }
        response = self._client.post("/dex/swap", json=payload)
        self._handle_response(response)
        return response.json()
    
    # ==================== Wallet ====================
    
    def get_wallet_balances(self, address: str) -> List[WalletBalance]:
        """Get wallet balances."""
        response = self._client.get(f"/wallet/{address}/balances")
        self._handle_response(response)
        data = response.json()
        
        if isinstance(data, dict) and "data" in data:
            return [WalletBalance(**item) for item in data["data"]]
        return [WalletBalance(**item) for item in data]
    
    def get_wallet_transactions(
        self,
        address: str,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get wallet transaction history."""
        response = self._client.get(
            f"/wallet/{address}/transactions",
            params={"limit": limit},
        )
        self._handle_response(response)
        data = response.json()
        
        if isinstance(data, dict) and "data" in data:
            return data["data"]
        return data
    
    # ==================== Raw MCP ====================
    
    def call_mcp_tool(
        self,
        tool_name: str,
        params: Dict[str, Any],
    ) -> Any:
        """Call an MCP tool directly."""
        payload = {
            "tool": tool_name,
            "params": params,
        }
        response = self._client.post("/mcp/call", json=payload)
        self._handle_response(response)
        return response.json()
    
    # ==================== Error Handling ====================
    
    def _handle_response(self, response: httpx.Response) -> None:
        """Handle API response and raise errors if needed."""
        if response.status_code < 400:
            return
        
        try:
            error_data = response.json()
            error_message = error_data.get("error", error_data.get("message", "Unknown error"))
        except Exception:
            error_message = response.text or "Unknown error"
        
        if response.status_code == 401:
            raise AuthenticationError(error_message)
        elif response.status_code == 422:
            raise ValidationError(error_message)
        else:
            raise ApiError(error_message, status_code=response.status_code)


def create_client(**kwargs) -> MangroveClient:
    """Create a MangroveClient with the given arguments."""
    return MangroveClient(**kwargs)
