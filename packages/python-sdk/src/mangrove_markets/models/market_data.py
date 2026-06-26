from __future__ import annotations

from typing import Any

from pydantic import field_validator

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


class TokenTag(MangroveModel):
    """A token classification tag.

    The 1inch token list returns tags as ``{provider, value}`` objects
    (e.g. ``{"provider": "1inch", "value": "bluechip"}``). Other token
    sources may emit bare strings; those are normalized to ``{value: ...}``
    by ``TokenInfo._normalize_tags`` below.
    """

    provider: str | None = None
    value: str | None = None


class TokenInfo(MangroveModel):
    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: str | None = None
    chain_id: int | None = None
    price_usd: str | None = None
    # The live server returns tags as {provider, value} objects, not bare
    # strings — modelling them as `list[str]` made every token_info call
    # ValidationError. Accept the object form, tolerate the string form.
    tags: list[TokenTag] | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def _normalize_tags(cls, v: Any) -> Any:
        if not isinstance(v, list):
            return v
        return [{"value": item} if isinstance(item, str) else item for item in v]


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
