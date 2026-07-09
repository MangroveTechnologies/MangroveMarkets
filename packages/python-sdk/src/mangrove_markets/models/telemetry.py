"""Trade-telemetry record — the wire contract shared with the agent + server.

Mirrors mangrove-agent's `Trade` model and the MCP server's ingestion
`TradeRecord`: one venue-agnostic record for a DEX swap, a CEX (e.g. Kraken)
fill, or a paper/validate sim. `user_id` is set server-side on ingestion from
the authenticated key — never trusted from the client.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class TradeRecord(BaseModel):
    id: str
    user_id: str | None = None  # stamped server-side at ingestion

    mode: Literal["live", "paper", "validate"]
    status: str

    venue: str | None = None
    venue_order_ref: str | None = None
    venue_trade_ref: str | None = None
    tx_hash: str | None = None  # on-chain (DEX) only; null for CEX spot

    side: Literal["buy", "sell"] | None = None
    base: str | None = None
    quote: str | None = None
    qty: float | None = None

    input_token: str | None = None
    input_amount: float | None = None
    output_token: str | None = None
    output_amount: float | None = None

    fill_price: float | None = None
    fees: dict[str, Any] = Field(default_factory=dict)
    p_and_l: float | None = None

    strategy_id: str | None = None
    evaluation_id: str | None = None

    executed_at: datetime
    confirmed_at: datetime | None = None
