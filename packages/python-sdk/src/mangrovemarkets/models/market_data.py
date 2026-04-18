from __future__ import annotations

from typing import Any

from ._base import MangroveModel


class Balances(MangroveModel):
    chain_id: int
    wallet: str
    balances: dict[str, str]


class SpotPrice(MangroveModel):
    chain_id: int
    prices: dict[str, str]


class GasPrice(MangroveModel):
    """Gas price data from oneinch_gas_price.

    The server returns EIP-1559 gas data nested under `gas`:
        gas.baseFee: str
        gas.low / gas.medium / gas.high / gas.instant: {maxPriorityFeePerGas, maxFeePerGas}

    The flat low/medium/high fields are kept for backwards compatibility
    with legacy chains that return non-EIP-1559 data.
    """

    chain_id: int
    gas: dict[str, Any] | None = None
    low: str | None = None
    medium: str | None = None
    high: str | None = None
    base_fee: str | None = None


class TokenSearchResult(MangroveModel):
    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: str | None = None
    chain_id: int | None = None


class TokenInfo(MangroveModel):
    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: str | None = None
    chain_id: int | None = None
    price_usd: str | None = None
    tags: list[str] | None = None


class Allowance(MangroveModel):
    token: str
    allowance: str


class ChartCandle(MangroveModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None
