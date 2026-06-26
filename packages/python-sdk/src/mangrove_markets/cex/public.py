"""Thin synchronous wrappers over Kraken's public endpoints.

Ported from the server's ``src/cex/kraken/public.py`` (async -> sync). Each
function returns the raw ``result`` dict from the Kraken response. No mapping
or domain translation here — that lives in ``mapping.py``.
"""
from __future__ import annotations

from typing import Any

from .client import KrakenHttpClient


def server_time(client: KrakenHttpClient) -> dict[str, Any]:
    return client.public_get("/0/public/Time")


def system_status(client: KrakenHttpClient) -> dict[str, Any]:
    return client.public_get("/0/public/SystemStatus")


def assets(
    client: KrakenHttpClient,
    asset: str | None = None,
    aclass: str | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {}
    if asset is not None:
        params["asset"] = asset
    if aclass is not None:
        params["aclass"] = aclass
    return client.public_get("/0/public/Assets", params=params or None)


def asset_pairs(
    client: KrakenHttpClient,
    pair: str | None = None,
    info: str | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {}
    if pair is not None:
        params["pair"] = pair
    if info is not None:
        params["info"] = info
    return client.public_get("/0/public/AssetPairs", params=params or None)


def ticker(client: KrakenHttpClient, pair: str) -> dict[str, Any]:
    return client.public_get("/0/public/Ticker", params={"pair": pair})


def ohlc(
    client: KrakenHttpClient,
    pair: str,
    interval: int = 1,
    since: int | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {"pair": pair, "interval": interval}
    if since is not None:
        params["since"] = since
    return client.public_get("/0/public/OHLC", params=params)


def depth(client: KrakenHttpClient, pair: str, count: int | None = None) -> dict[str, Any]:
    params: dict[str, Any] = {"pair": pair}
    if count is not None:
        params["count"] = count
    return client.public_get("/0/public/Depth", params=params)


def trades(
    client: KrakenHttpClient,
    pair: str,
    since: str | None = None,
    count: int | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {"pair": pair}
    if since is not None:
        params["since"] = since
    if count is not None:
        params["count"] = count
    return client.public_get("/0/public/Trades", params=params)


def spread(client: KrakenHttpClient, pair: str, since: str | None = None) -> dict[str, Any]:
    params: dict[str, Any] = {"pair": pair}
    if since is not None:
        params["since"] = since
    return client.public_get("/0/public/Spread", params=params)
