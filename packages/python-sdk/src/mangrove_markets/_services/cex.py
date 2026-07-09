"""CexService — keyless CEX (Kraken) access via the platform OAuth proxy.

The counterpart to the BYOK ``KrakenClient`` (which holds the user's own key
locally and talks to Kraken directly). This service holds **no venue
credential**: it calls the MangroveMarkets server's exchange-proxy routes,
authed by the caller's Mangrove key, and the platform executes against the
user's OAuth-linked Kraken account. ``user_id`` is derived server-side — never
sent by this client.

    client.cex.connect_start(mode="execute")  -> {authorize_url, state}
    client.cex.status()                        -> {connected, connection:{mode,...}}
    client.cex.balances()                      -> {balances:[...]}
    client.cex.place_order(base="XRP", quote="USDC", side="buy",
                           volume="5", validate_only=True)
    client.cex.open_orders()
    client.cex.cancel_order(tx_id)
"""
from __future__ import annotations

from typing import Any

from ..exceptions import APIError
from ._base import BaseService


class CexService(BaseService):
    _BASE = "/exchanges/kraken"

    def _request(self, method: str, path: str, *, json: Any | None = None) -> dict[str, Any]:
        resp = self._transport.request(method, f"{self._BASE}{path}", json=json)
        data = resp.json()
        if resp.status_code >= 400:
            detail = data.get("detail") if isinstance(data, dict) else None
            raise APIError(
                status_code=resp.status_code,
                error="cex_proxy_error",
                message=str(detail or f"CEX proxy returned HTTP {resp.status_code}"),
                code="CEX_PROXY_ERROR",
                suggestion=None,
            )
        return data if isinstance(data, dict) else {"data": data}

    def connect_start(self, *, mode: str = "view") -> dict[str, Any]:
        """Begin an OAuth connect. Returns {authorize_url, state}; the user opens
        the URL and consents. mode = 'view' (read-only) or 'execute' (+trading)."""
        return self._request("POST", "/connect", json={"mode": mode})

    def status(self) -> dict[str, Any]:
        """Connection status: {connected, connection:{mode, alias, ...}}."""
        return self._request("GET", "/status")

    def balances(self) -> dict[str, Any]:
        """USD-valued balances for the connected account."""
        return self._request("GET", "/balances")

    def place_order(
        self,
        *,
        base: str,
        quote: str,
        side: str,
        volume: str,
        order_type: str = "market",
        limit_price: str | None = None,
        client_ref: str | None = None,
        validate_only: bool = False,
    ) -> dict[str, Any]:
        """Place (or, with validate_only=True, venue-validate) a spot order.
        Requires an execute-mode connection; a view-only connection is refused
        by the platform."""
        body: dict[str, Any] = {
            "base": base,
            "quote": quote,
            "side": side,
            "order_type": order_type,
            "volume": volume,
            "validate_only": validate_only,
        }
        if limit_price is not None:
            body["limit_price"] = limit_price
        if client_ref is not None:
            body["client_ref"] = client_ref
        return self._request("POST", "/orders", json=body)

    def open_orders(self) -> dict[str, Any]:
        return self._request("GET", "/orders")

    def cancel_order(self, tx_id: str) -> dict[str, Any]:
        return self._request("DELETE", f"/orders/{tx_id}")
