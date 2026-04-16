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
    chain_id: int
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
