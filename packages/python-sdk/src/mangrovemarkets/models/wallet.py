from __future__ import annotations

from typing import Any

from ._base import MangroveModel


class ChainInfo(MangroveModel):
    """Chain configuration from wallet_chain_info."""

    chain: str
    chain_family: str
    native_token: str
    wallet_creation: str
    supported_chain_ids: list[int] | None = None
    networks: dict[str, Any] | None = None
    sdk_method: str | None = None


class WalletCreateResult(MangroveModel):
    """Result of wallet_create. Secrets returned once at creation only."""

    address: str
    secret: str | None = None
    private_key: str | None = None
    seed_phrase: str | None = None
    chain: str = "xrpl"
    chain_id: int | None = None
    network: str = "testnet"
    is_funded: bool = False
    warnings: list[str] | None = None
