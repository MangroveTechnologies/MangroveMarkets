"""KrakenClient — client-side BYOK access to Kraken (CEX).

BYOK invariant: the user's Kraken API key + secret are passed in by the caller
(the local agent, from its on-machine vault) and used to call ``api.kraken.com``
**directly**. The key never goes to a Mangrove server. This client is separate
from the MCP-server transport for exactly that reason.

Defaults to **validate-only** orders (dry-run) — placing a real fill requires
an explicit ``validate=False``.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import time
import urllib.parse
from datetime import datetime, timezone
from typing import Any

import httpx

from ..exceptions import ConfigurationError, MangroveError
from ..models.telemetry import TradeRecord

_API_BASE = "https://api.kraken.com"

# Mangrove's Kraken broker/partner IBAN. Attached to every AddOrder so trades
# placed through the SDK attribute to Mangrove's partner program — attribution
# metadata only (like an affiliate tag): it never grants access to the user's
# account and works precisely because the user's key stays local (BYOK).
MANGROVE_BROKER = "AA96 N84G W5Q2 MZAY"


class KrakenError(MangroveError):
    """A Kraken API returned a non-empty `error` array."""


def _sign(urlpath: str, data: dict[str, Any], secret: str) -> str:
    """Kraken private-request signature (API-Sign header).

    HMAC-SHA512( urlpath + SHA256(nonce + urlencoded-postdata), b64decode(secret) )
    """
    postdata = urllib.parse.urlencode(data)
    encoded = (str(data["nonce"]) + postdata).encode()
    message = urlpath.encode() + hashlib.sha256(encoded).digest()
    sig = hmac.new(base64.b64decode(secret), message, hashlib.sha512)
    return base64.b64encode(sig.digest()).decode()


class KrakenClient:
    def __init__(
        self,
        api_key: str | None = None,
        api_secret: str | None = None,
        *,
        base_url: str = _API_BASE,
        http: httpx.Client | None = None,
        nonce_fn: Any | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._key = api_key
        self._secret = api_secret
        self._base = base_url.rstrip("/")
        self._http = http or httpx.Client(timeout=timeout)
        self._nonce = nonce_fn or (lambda: str(int(time.time() * 1000)))

    # -- transport ----------------------------------------------------------
    @staticmethod
    def _unwrap(resp: httpx.Response) -> dict[str, Any]:
        body = resp.json()
        err = body.get("error") or []
        if err:
            raise KrakenError(f"Kraken API error: {', '.join(err)}")
        return body.get("result", {}) or {}

    def _public(self, method: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
        resp = self._http.post(f"{self._base}/0/public/{method}", data=data or {})
        return self._unwrap(resp)

    def _private(self, method: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self._key or not self._secret:
            raise ConfigurationError(
                "Kraken API key + secret are required for private endpoints "
                "(provide them via the local vault; they never leave the machine)."
            )
        body = dict(data or {})
        body["nonce"] = self._nonce()
        urlpath = f"/0/private/{method}"
        headers = {"API-Key": self._key, "API-Sign": _sign(urlpath, body, self._secret)}
        resp = self._http.post(self._base + urlpath, data=body, headers=headers)
        return self._unwrap(resp)

    # -- public (no key) ----------------------------------------------------
    def assets(self) -> dict[str, Any]:
        return self._public("Assets")

    def asset_pairs(self, pair: str | None = None) -> dict[str, Any]:
        return self._public("AssetPairs", {"pair": pair} if pair else None)

    def ticker(self, pair: str) -> dict[str, Any]:
        return self._public("Ticker", {"pair": pair})

    # -- private (BYOK key) -------------------------------------------------
    def balance(self) -> dict[str, Any]:
        return self._private("Balance")

    def add_order(
        self,
        *,
        pair: str,
        side: str,
        ordertype: str = "market",
        volume: float,
        price: float | None = None,
        validate: bool = True,
    ) -> dict[str, Any]:
        """Place (or with ``validate=True``, dry-run) an order via AddOrder.

        Defaults to validate-only — a real fill needs ``validate=False``.
        """
        data: dict[str, Any] = {
            "pair": pair,
            "type": side,
            "ordertype": ordertype,
            "volume": str(volume),
            # Partner attribution on every order, validate-only included so the
            # dry-run checks the exact payload a live order would send.
            "broker": MANGROVE_BROKER,
        }
        if price is not None:
            data["price"] = str(price)
        if validate:
            data["validate"] = "true"
        return self._private("AddOrder", data)

    def trades_history(self) -> dict[str, Any]:
        return self._private("TradesHistory")

    # -- mapping → the shared TradeRecord contract --------------------------
    def trades_as_records(self, *, mode: str = "live") -> list[TradeRecord]:
        """Pull the user's Kraken fills and map them to TradeRecords.

        ``base`` carries the raw Kraken pair code (e.g. ``XXBTZUSD``); pair →
        base/quote normalization is a later refinement. ``tx_hash`` is always
        None (Kraken spot is off-chain); the identifier is ``venue_trade_ref``.
        """
        result = self.trades_history()
        records: list[TradeRecord] = []
        for trade_id, t in (result.get("trades") or {}).items():
            records.append(
                TradeRecord(
                    id=f"kraken:{trade_id}",
                    mode=mode,  # type: ignore[arg-type]
                    status="confirmed",
                    venue="kraken",
                    venue_trade_ref=trade_id,
                    venue_order_ref=t.get("ordertxid"),
                    side=t.get("type"),
                    base=t.get("pair"),
                    qty=float(t["vol"]),
                    fill_price=float(t["price"]),
                    fees={"fee": float(t.get("fee", 0) or 0)},
                    tx_hash=None,
                    executed_at=datetime.fromtimestamp(float(t["time"]), tz=timezone.utc),
                )
            )
        return records

    def close(self) -> None:
        self._http.close()
