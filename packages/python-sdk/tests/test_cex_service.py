"""CexService tests — keyless CEX access via the platform OAuth proxy.

Verifies the client hits /api/v1/exchanges/kraken/* with the Mangrove key as
Bearer (never a venue key), forwards mode/order fields, unwraps responses, and
maps proxy errors to APIError. user_id is never client-sent.
"""
from __future__ import annotations

from urllib.parse import urlparse

import httpx
import pytest

from mangrove_markets import MangroveMarkets
from mangrove_markets._transport._mock import MockTransport
from mangrove_markets.exceptions import APIError


def _client(mock: MockTransport) -> MangroveMarkets:
    return MangroveMarkets(base_url="http://x", api_key="prod_abc", httpx_client=mock)


def test_connect_start_posts_with_bearer_and_mode():
    mock = MockTransport()
    mock.add_response("POST", "/exchanges/kraken/connect",
                      json={"authorize_url": "https://id.kraken.com/x", "state": "s"})
    out = _client(mock).cex.connect_start(mode="execute")

    # Exact parsed-host compare, not a URL prefix (avoids the incomplete-URL-
    # substring anti-pattern CodeQL flags).
    parsed = urlparse(out["authorize_url"])
    assert (parsed.scheme, parsed.netloc) == ("https", "id.kraken.com")
    req = mock.requests[-1]
    assert req.method == "POST"
    assert req.url.endswith("/api/v1/exchanges/kraken/connect")
    assert req.headers.get("Authorization") == "Bearer prod_abc"  # Mangrove key, not a venue key
    assert req.json == {"mode": "execute"}
    assert req.json.get("user_id") is None  # never client-supplied


def test_status_and_balances_are_gets():
    mock = MockTransport()
    mock.add_response("GET", "/exchanges/kraken/status",
                      json={"connected": True, "connection": {"mode": "execute"}})
    mock.add_response("GET", "/exchanges/kraken/balances", json={"balances": [{"asset": "XRP"}]})
    client = _client(mock)

    assert client.cex.status()["connection"]["mode"] == "execute"
    assert client.cex.balances()["balances"][0]["asset"] == "XRP"


def test_place_order_forwards_fields_and_omits_none():
    mock = MockTransport()
    mock.add_response("POST", "/exchanges/kraken/orders",
                      json={"pair": "XRPUSDC", "validate_only": True, "tx_ids": []})
    out = _client(mock).cex.place_order(
        base="XRP", quote="USDC", side="buy", volume="5", validate_only=True,
    )
    assert out["pair"] == "XRPUSDC"
    body = mock.requests[-1].json
    assert body == {"base": "XRP", "quote": "USDC", "side": "buy",
                    "order_type": "market", "volume": "5", "validate_only": True}
    assert "limit_price" not in body and "client_ref" not in body


def test_cancel_order_is_delete_on_txid_path():
    mock = MockTransport()
    mock.add_response("DELETE", "/exchanges/kraken/orders/OABC-123", json={"count": 1})
    out = _client(mock).cex.cancel_order("OABC-123")
    assert out["count"] == 1
    req = mock.requests[-1]
    assert req.method == "DELETE" and req.url.endswith("/exchanges/kraken/orders/OABC-123")


def test_proxy_error_maps_to_apierror():
    mock = MockTransport()
    mock.add_response("POST", "/exchanges/kraken/orders", status_code=403,
                      json={"detail": "connection is view-only; reconnect in execute mode",
                            "code": "EXECUTE_SCOPE_REQUIRED"},
                      headers={"X-Request-Id": "fixture-request"})
    with pytest.raises(APIError, match="view-only") as exc_info:
        _client(mock).cex.place_order(base="XRP", quote="USDC", side="buy", volume="5")

    error = exc_info.value
    assert error.status_code == 403
    assert error.code == "EXECUTE_SCOPE_REQUIRED"
    assert error.response_headers == {"X-Request-Id": "fixture-request"}
    assert error.response_body == {
        "detail": "connection is view-only; reconnect in execute mode",
        "code": "EXECUTE_SCOPE_REQUIRED",
    }


def test_ambiguous_order_failure_is_not_automatically_replayed():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(503, json={"detail": "upstream outcome is unknown"})

    http_client = httpx.Client(transport=httpx.MockTransport(handler))
    client = MangroveMarkets(
        base_url="https://fixture.invalid",
        api_key="fixture-market-key",
        max_retries=3,
        auto_retry=True,
        httpx_client=http_client,
    )
    with client, pytest.raises(APIError, match="outcome is unknown"):
        client.cex.place_order(base="XRP", quote="USDC", side="buy", volume="5")
    assert len(requests) == 1
