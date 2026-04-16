from __future__ import annotations

from typing import Any

from ._base import MangroveModel


class Venue(MangroveModel):
    id: str
    name: str
    chain: str
    status: str = "active"
    supported_pairs_count: int = 0
    fee_percent: float = 0.0


class TradingPair(MangroveModel):
    venue_id: str
    base_token: str
    quote_token: str
    min_amount: float | None = None
    max_amount: float | None = None
    is_active: bool = True


class Quote(MangroveModel):
    quote_id: str
    venue_id: str
    input_token: str
    output_token: str
    input_amount: float
    output_amount: float
    exchange_rate: float
    price_impact_percent: float = 0.0
    venue_fee: float = 0.0
    mangrove_fee: float = 0.0
    total_cost: float = 0.0
    expires_at: str | None = None
    chain_id: int | None = None
    billing_mode: str | None = None
    routes: list[Any] | None = None


class UnsignedTransaction(MangroveModel):
    """Unsigned tx data. Agent signs locally. SDK never sees private keys."""

    chain_family: str
    chain_id: int | None = None
    venue_id: str
    description: str
    payload: dict[str, Any]
    estimated_gas: str | None = None
    expires_at: str | None = None


class BroadcastResult(MangroveModel):
    tx_hash: str
    chain_family: str
    chain_id: int | None = None
    venue_id: str
    broadcast_method: str = "public"


class TransactionStatus(MangroveModel):
    tx_hash: str
    chain_family: str
    chain_id: int | None = None
    status: str
    block_number: int | None = None
    confirmations: int | None = None
    gas_used: str | None = None
    error_message: str | None = None
