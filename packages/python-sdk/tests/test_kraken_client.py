"""KrakenClient (BYOK) tests — all mocked, no real key or network."""
from __future__ import annotations

import base64

import httpx
import pytest

from mangrove_markets import KrakenClient, KrakenError
from mangrove_markets.exceptions import ConfigurationError

_SECRET = base64.b64encode(b"unit-test-kraken-secret-bytes-000").decode()


def _client(handler, *, key="testkey", secret=_SECRET):
    http = httpx.Client(transport=httpx.MockTransport(handler))
    return KrakenClient(key, secret, http=http, nonce_fn=lambda: "1")


def test_public_ticker_needs_no_key():
    seen = {}

    def handler(req):
        seen["path"] = req.url.path
        return httpx.Response(200, json={"error": [], "result": {"XXBTZUSD": {"c": ["64000.0", "0.01"]}}})

    c = KrakenClient(http=httpx.Client(transport=httpx.MockTransport(handler)))
    res = c.ticker("XBTUSD")
    assert seen["path"] == "/0/public/Ticker"
    assert "XXBTZUSD" in res


def test_private_endpoint_requires_key():
    c = KrakenClient(http=httpx.Client(transport=httpx.MockTransport(
        lambda r: httpx.Response(200, json={"error": [], "result": {}}))))
    with pytest.raises(ConfigurationError):
        c.balance()


def test_private_request_is_signed():
    seen = {}

    def handler(req):
        seen["path"] = req.url.path
        seen["api_key"] = req.headers.get("API-Key")
        seen["api_sign"] = req.headers.get("API-Sign")
        seen["content"] = req.content.decode()
        return httpx.Response(200, json={"error": [], "result": {"ZUSD": "100.0"}})

    res = _client(handler).balance()
    assert seen["path"] == "/0/private/Balance"
    assert seen["api_key"] == "testkey"
    assert seen["api_sign"]              # non-empty HMAC signature
    assert "nonce=1" in seen["content"]
    assert res["ZUSD"] == "100.0"


def test_add_order_defaults_to_validate_only():
    seen = {}

    def handler(req):
        seen["content"] = req.content.decode()
        return httpx.Response(200, json={"error": [], "result": {"descr": {"order": "buy 0.01 XBTUSD @ market"}, "txid": []}})

    res = _client(handler).add_order(pair="XBTUSD", side="buy", volume=0.01)
    assert "validate=true" in seen["content"]   # dry-run unless validate=False
    assert "descr" in res


def test_add_order_live_when_validate_false():
    seen = {}

    def handler(req):
        seen["content"] = req.content.decode()
        return httpx.Response(200, json={"error": [], "result": {"txid": ["OXXXX-1"]}})

    _client(handler).add_order(pair="XBTUSD", side="buy", volume=0.01, validate=False)
    assert "validate" not in seen["content"]


def test_trades_as_records_maps_kraken_fill():
    def handler(req):
        return httpx.Response(200, json={"error": [], "result": {"trades": {
            "TQLM2-ABC-XYZ": {
                "ordertxid": "OABC-1", "pair": "XXBTZUSD", "time": 1750000000.0,
                "type": "buy", "ordertype": "market", "price": "64000.0",
                "cost": "640.0", "fee": "1.02", "vol": "0.01",
            }}}})

    recs = _client(handler).trades_as_records()
    assert len(recs) == 1
    r = recs[0]
    assert r.venue == "kraken"
    assert r.venue_trade_ref == "TQLM2-ABC-XYZ"
    assert r.venue_order_ref == "OABC-1"
    assert r.side == "buy" and r.qty == 0.01 and r.fill_price == 64000.0
    assert r.tx_hash is None                    # CEX spot — no chain hash
    assert r.fees == {"fee": 1.02}
    assert r.id == "kraken:TQLM2-ABC-XYZ"


def test_kraken_api_error_is_raised():
    c = _client(lambda r: httpx.Response(200, json={"error": ["EGeneral:Invalid arguments"], "result": {}}))
    with pytest.raises(KrakenError):
        c.balance()
