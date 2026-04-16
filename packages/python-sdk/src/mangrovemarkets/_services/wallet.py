from __future__ import annotations

from typing import Any

from ..exceptions import NotImplementedOnServer
from ..models.wallet import ChainInfo, WalletCreateResult
from ._base import BaseService


class WalletService(BaseService):
    """Wallet management operations."""

    def chain_info(self, chain: str = "xrpl") -> ChainInfo:
        """Get chain configuration. Use before creating a wallet."""
        return self._call_tool_model("wallet_chain_info", ChainInfo, {"chain": chain})

    def create(
        self,
        chain: str = "xrpl",
        network: str = "testnet",
        chain_id: int | None = None,
    ) -> WalletCreateResult:
        """Create a new wallet. Secrets are returned once and never stored."""
        params: dict[str, Any] = {"chain": chain, "network": network}
        if chain_id is not None:
            params["chain_id"] = chain_id
        return self._call_tool_model("wallet_create", WalletCreateResult, params)

    def balance(self, address: str, chain: str = "xrpl") -> Any:
        """Check wallet balance. NOT_IMPLEMENTED on server (Phase 1)."""
        raise NotImplementedOnServer(
            "wallet_balance is not yet implemented on the server (Phase 1)"
        )

    def transactions(self, address: str, chain: str = "xrpl", limit: int = 50) -> Any:
        """List wallet transactions. NOT_IMPLEMENTED on server (Phase 1)."""
        raise NotImplementedOnServer(
            "wallet_transactions is not yet implemented on the server (Phase 1)"
        )
