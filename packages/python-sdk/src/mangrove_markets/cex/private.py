"""Thin synchronous wrappers over Kraken's signed private endpoints.

Ported from the server's ``src/cex/kraken/private.py`` (async -> sync). Each
function forwards to ``KrakenClient.private_post`` with the right path and body.
No mapping or domain translation — that lives in ``mapping.py``.

The Kraken REST form encoding flattens list-valued fields by joining them with
commas (e.g. ``txid=OID1,OID2``, ``pair=XBTUSD,ETHUSD``). We do that
normalization here so callers can pass Python lists.
"""
from __future__ import annotations

from typing import Any

from .client import KrakenHttpClient


def _joined(value: Any) -> Any:
    """Kraken form-encodes lists as comma-separated strings."""
    if isinstance(value, list):
        return ",".join(str(v) for v in value)
    return value


def _flatten(body: dict[str, Any]) -> dict[str, Any]:
    return {k: _joined(v) for k, v in body.items() if v is not None}


# ---------------------------------------------------------------------------
# Account / balance
# ---------------------------------------------------------------------------


def balance(client: KrakenHttpClient) -> dict[str, Any]:
    return client.private_post("/0/private/Balance")


def balance_ex(client: KrakenHttpClient) -> dict[str, Any]:
    return client.private_post("/0/private/BalanceEx")


def trade_balance(client: KrakenHttpClient, asset: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if asset is not None:
        body["asset"] = asset
    return client.private_post("/0/private/TradeBalance", body=body or None)


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------


def add_order(client: KrakenHttpClient, **kwargs: Any) -> dict[str, Any]:
    """Place a new order. Supports all AddOrder params including close[*]."""
    return client.private_post("/0/private/AddOrder", body=_flatten(kwargs))


def edit_order(client: KrakenHttpClient, txid: str, **kwargs: Any) -> dict[str, Any]:
    body = {"txid": txid, **kwargs}
    return client.private_post("/0/private/EditOrder", body=_flatten(body))


def cancel_order(client: KrakenHttpClient, txid: str) -> dict[str, Any]:
    return client.private_post("/0/private/CancelOrder", body={"txid": txid})


def cancel_all(client: KrakenHttpClient) -> dict[str, Any]:
    return client.private_post("/0/private/CancelAll")


# ---------------------------------------------------------------------------
# Order queries
# ---------------------------------------------------------------------------


def open_orders(
    client: KrakenHttpClient,
    trades: bool = False,
    userref: int | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"trades": "true" if trades else "false"}
    if userref is not None:
        body["userref"] = userref
    return client.private_post("/0/private/OpenOrders", body=body)


def closed_orders(
    client: KrakenHttpClient,
    trades: bool = False,
    userref: int | None = None,
    start: int | None = None,
    end: int | None = None,
    ofs: int = 0,
    closetime: str = "both",
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "trades": "true" if trades else "false",
        "ofs": ofs,
        "closetime": closetime,
    }
    if userref is not None:
        body["userref"] = userref
    if start is not None:
        body["start"] = start
    if end is not None:
        body["end"] = end
    return client.private_post("/0/private/ClosedOrders", body=body)


def query_orders(
    client: KrakenHttpClient,
    txids: list[str],
    trades: bool = False,
    userref: int | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "txid": _joined(txids),
        "trades": "true" if trades else "false",
    }
    if userref is not None:
        body["userref"] = userref
    return client.private_post("/0/private/QueryOrders", body=body)


# ---------------------------------------------------------------------------
# Trade history
# ---------------------------------------------------------------------------


def trades_history(
    client: KrakenHttpClient,
    type: str | None = None,
    trades: bool = False,
    start: int | None = None,
    end: int | None = None,
    ofs: int = 0,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "trades": "true" if trades else "false",
        "ofs": ofs,
    }
    if type is not None:
        body["type"] = type
    if start is not None:
        body["start"] = start
    if end is not None:
        body["end"] = end
    return client.private_post("/0/private/TradesHistory", body=body)


def query_trades(
    client: KrakenHttpClient,
    txids: list[str],
    trades: bool = False,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "txid": _joined(txids),
        "trades": "true" if trades else "false",
    }
    return client.private_post("/0/private/QueryTrades", body=body)


# ---------------------------------------------------------------------------
# Trade volume / fees
# ---------------------------------------------------------------------------


def trade_volume(
    client: KrakenHttpClient,
    pair: list[str] | None = None,
    fee_info: bool = True,
) -> dict[str, Any]:
    body: dict[str, Any] = {"fee-info": "true" if fee_info else "false"}
    if pair:
        body["pair"] = _joined(pair)
    return client.private_post("/0/private/TradeVolume", body=body)
