from __future__ import annotations

from typing import Any

from ..models.portfolio import (
    PortfolioDefi,
    PortfolioPnL,
    PortfolioTokens,
    PortfolioValue,
    TxHistoryEntry,
)
from ._base import BaseService


class PortfolioService(BaseService):
    """Cross-chain portfolio analytics. Currently 1inch-powered but venue-agnostic API."""

    def value(self, addresses: str, chain_id: int | None = None) -> PortfolioValue:
        """Get total portfolio value across chains."""
        params: dict[str, Any] = {"addresses": addresses}
        if chain_id is not None:
            params["chain_id"] = chain_id
        return self._call_tool_model("oneinch_portfolio_value", PortfolioValue, params)

    def pnl(self, addresses: str, chain_id: int | None = None) -> PortfolioPnL:
        """Get profit and loss across chains."""
        params: dict[str, Any] = {"addresses": addresses}
        if chain_id is not None:
            params["chain_id"] = chain_id
        return self._call_tool_model("oneinch_portfolio_pnl", PortfolioPnL, params)

    def tokens(self, addresses: str, chain_id: int | None = None) -> PortfolioTokens:
        """Get token holdings across chains."""
        params: dict[str, Any] = {"addresses": addresses}
        if chain_id is not None:
            params["chain_id"] = chain_id
        return self._call_tool_model(
            "oneinch_portfolio_tokens", PortfolioTokens, params
        )

    def defi(self, addresses: str, chain_id: int | None = None) -> PortfolioDefi:
        """Get DeFi positions across chains."""
        params: dict[str, Any] = {"addresses": addresses}
        if chain_id is not None:
            params["chain_id"] = chain_id
        return self._call_tool_model("oneinch_portfolio_defi", PortfolioDefi, params)

    def history(self, address: str, limit: int = 50) -> list[TxHistoryEntry]:
        """Get transaction history for an address."""
        data = self._call_tool("oneinch_history", {"address": address, "limit": limit})
        return [
            TxHistoryEntry.model_validate(tx)
            for tx in data.get("transactions", [])
        ]
