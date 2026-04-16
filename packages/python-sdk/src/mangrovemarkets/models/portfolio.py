from __future__ import annotations

from typing import Any

from ._base import MangroveModel


class PortfolioValue(MangroveModel):
    total_value_usd: float | None = None
    chains: dict[str, Any] | None = None


class PortfolioPnL(MangroveModel):
    total_pnl_usd: float | None = None
    chains: dict[str, Any] | None = None


class PortfolioTokens(MangroveModel):
    tokens: list[dict[str, Any]] | None = None


class PortfolioDefi(MangroveModel):
    positions: list[dict[str, Any]] | None = None


class TxHistoryEntry(MangroveModel):
    tx_hash: str
    chain_id: int | None = None
    block_number: int | None = None
    timestamp: str | None = None
    from_address: str | None = None
    to_address: str | None = None
    value: str | None = None
    status: str | None = None
