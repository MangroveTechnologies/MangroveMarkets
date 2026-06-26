"""Tests for the client-side Kraken BYOK module.

Mirrors the server's test approach: mock the HTTP layer (httpx), assert the
signing scheme produces a deterministic signature for known inputs, nonce
monotonicity, structured error mapping, and that missing credentials raise.

The signing vector is verified against an independent reimplementation of
Kraken's documented scheme (HMAC-SHA512 over uri_path + SHA256(nonce + body)),
so the test is an oracle, not a snapshot of our own output.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
from urllib.parse import urlencode

import httpx
import pytest

from mangrove_markets import KrakenClient as TopLevelKrakenClient
from mangrove_markets.cex import (
    CredentialsRequiredError,
    InvalidCredentialsError,
    InvalidNonceError,
    KrakenClient,
    OrderMinNotMetError,
    PermissionDeniedError,
    RateLimitedError,
    UnknownCexError,
)
from mangrove_markets.cex.client import (
    KrakenHttpClient,
    _RateCounter,
    _rest_cost,
)
from mangrove_markets.cex.error_mapping import map_error
from mangrove_markets.cex.models import OrderRequest, OrderSide, OrderType

# A valid base64 secret (decodes cleanly) — not a real Kraken key.
TEST_SECRET = base64.b64encode(b"kraken-byok-test-secret-bytes-32x").decode()
TEST_KEY = "TEST_API_KEY_1234567890"


# ---------------------------------------------------------------------------
# Fake httpx transport
# ---------------------------------------------------------------------------


class _Recorder:
    """Captures requests and serves canned JSON responses via httpx.MockTransport."""

    def __init__(self, response_json: dict, status: int = 200) -> None:
        self.response_json = response_json
        self.status = status
        self.requests: list[httpx.Request] = []
        # Per-call responses, if set, take precedence (FIFO).
        self.queue: list[dict] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.queue:
            return httpx.Response(200, json=self.queue.pop(0))
        return httpx.Response(self.status, json=self.response_json)


def _make_client(response_json: dict, **kwargs) -> tuple[KrakenClient, _Recorder]:
    rec = _Recorder(response_json)
    kraken = KrakenClient(api_key=TEST_KEY, api_secret=TEST_SECRET, **kwargs)
    # Swap in a mocked httpx.Client bound to our recorder.
    kraken._client._http = httpx.Client(
        base_url="https://api.kraken.com",
        transport=httpx.MockTransport(rec.handler),
    )
    return kraken, rec


# ---------------------------------------------------------------------------
# Credential gate
# ---------------------------------------------------------------------------


class TestCredentialGate:
    def test_missing_key_raises(self) -> None:
        with pytest.raises(CredentialsRequiredError) as exc:
            KrakenClient(api_key="", api_secret=TEST_SECRET)
        assert exc.value.code == "CEX_CREDENTIALS_REQUIRED"

    def test_missing_secret_raises(self) -> None:
        with pytest.raises(CredentialsRequiredError):
            KrakenClient(api_key=TEST_KEY, api_secret="")

    def test_blank_whitespace_raises(self) -> None:
        with pytest.raises(CredentialsRequiredError):
            KrakenClient(api_key="   ", api_secret=TEST_SECRET)

    def test_error_envelope(self) -> None:
        try:
            KrakenClient(api_key="", api_secret="")
        except CredentialsRequiredError as e:
            d = e.to_dict()
            assert d["error"] is True
            assert d["code"] == "CEX_CREDENTIALS_REQUIRED"
            assert d["suggestion"]

    def test_factory_on_main_client_requires_key(self) -> None:
        from mangrove_markets import MangroveMarkets

        client = MangroveMarkets(base_url="http://localhost:8080")
        with pytest.raises(CredentialsRequiredError):
            client.cex(api_key="", api_secret="")
        # And constructs when given a key.
        kc = client.cex(api_key=TEST_KEY, api_secret=TEST_SECRET)
        assert isinstance(kc, TopLevelKrakenClient)
        kc.close()


# ---------------------------------------------------------------------------
# Signing — verified against an independent oracle
# ---------------------------------------------------------------------------


def _expected_sign(secret: str, uri_path: str, nonce: str, postdata: str) -> str:
    encoded = (nonce + postdata).encode()
    message = uri_path.encode() + hashlib.sha256(encoded).digest()
    mac = hmac.new(base64.b64decode(secret), message, hashlib.sha512)
    return base64.b64encode(mac.digest()).decode()


class TestSigning:
    def test_deterministic_known_vector(self) -> None:
        client = KrakenHttpClient(api_key=TEST_KEY, api_secret=TEST_SECRET)
        uri = "/0/private/Balance"
        nonce = "1700000000000"
        postdata = urlencode({"nonce": nonce})
        sig = client._sign(uri, nonce, postdata)
        assert sig == _expected_sign(TEST_SECRET, uri, nonce, postdata)
        # Stable across repeated calls with the same inputs.
        assert sig == client._sign(uri, nonce, postdata)

    def test_signature_changes_with_nonce(self) -> None:
        client = KrakenHttpClient(api_key=TEST_KEY, api_secret=TEST_SECRET)
        uri = "/0/private/Balance"
        a = client._sign(uri, "1", urlencode({"nonce": "1"}))
        b = client._sign(uri, "2", urlencode({"nonce": "2"}))
        assert a != b

    def test_private_post_sends_signed_headers(self) -> None:
        kraken, rec = _make_client({"error": [], "result": {"ZUSD": "100.0"}})
        kraken.get_balance()
        req = rec.requests[-1]
        assert req.headers["API-Key"] == TEST_KEY
        assert "API-Sign" in req.headers
        # The signature must match the oracle for the body that was actually sent.
        body = req.content.decode()
        # Extract nonce from the urlencoded body.
        nonce = dict(p.split("=") for p in body.split("&"))["nonce"]
        assert req.headers["API-Sign"] == _expected_sign(
            TEST_SECRET, "/0/private/BalanceEx", nonce, body
        )


# ---------------------------------------------------------------------------
# Nonce monotonicity
# ---------------------------------------------------------------------------


class TestNonce:
    def test_strictly_increasing(self) -> None:
        client = KrakenHttpClient(api_key=TEST_KEY, api_secret=TEST_SECRET)
        nonces = [int(client._next_nonce()) for _ in range(2000)]
        for prev, cur in zip(nonces, nonces[1:]):
            assert cur > prev, "nonce must be strictly monotonic"

    def test_collision_guard_increments(self) -> None:
        client = KrakenHttpClient(api_key=TEST_KEY, api_secret=TEST_SECRET)
        client._last_nonce = 10**15  # far in the future -> forces +1 path
        a = int(client._next_nonce())
        b = int(client._next_nonce())
        assert b == a + 1


# ---------------------------------------------------------------------------
# Error mapping
# ---------------------------------------------------------------------------


class TestErrorMapping:
    @pytest.mark.parametrize(
        "kraken_err,expected_cls,code",
        [
            ("EAPI:Invalid key", InvalidCredentialsError, "CEX_INVALID_CREDENTIALS"),
            ("EAPI:Invalid signature", InvalidCredentialsError, "CEX_INVALID_CREDENTIALS"),
            ("EGeneral:Permission denied", PermissionDeniedError, "CEX_PERMISSION_DENIED"),
            ("EAPI:Invalid nonce", InvalidNonceError, "CEX_INVALID_NONCE"),
            ("EAPI:Rate limit exceeded", RateLimitedError, "CEX_RATE_LIMITED"),
            ("EOrder:Order minimum not met", OrderMinNotMetError, "CEX_ORDER_MIN_NOT_MET"),
            ("ESomething:Totally unknown", UnknownCexError, "CEX_UNKNOWN"),
        ],
    )
    def test_map_error(self, kraken_err, expected_cls, code) -> None:
        mapped = map_error(kraken_err)
        assert isinstance(mapped, expected_cls)
        assert mapped.code == code

    def test_api_error_translated_on_call(self) -> None:
        kraken, _ = _make_client({"error": ["EGeneral:Permission denied"], "result": {}})
        with pytest.raises(PermissionDeniedError) as exc:
            kraken.get_balance()
        assert exc.value.code == "CEX_PERMISSION_DENIED"

    def test_public_call_error_translated(self) -> None:
        kraken, _ = _make_client({"error": ["EQuery:Unknown asset pair"], "result": {}})
        with pytest.raises(Exception) as exc:
            kraken.get_ticker("NOPE")
        assert exc.value.code == "CEX_PAIR_NOT_FOUND"


# ---------------------------------------------------------------------------
# Retry behavior
# ---------------------------------------------------------------------------


class TestRetry:
    def test_invalid_nonce_retries_once_then_succeeds(self) -> None:
        kraken, rec = _make_client({"error": [], "result": {}})
        # First call: invalid nonce. Second: success.
        rec.queue = [
            {"error": ["EAPI:Invalid nonce"], "result": {}},
            {"error": [], "result": {"ZUSD": "5.0"}},
        ]
        result = kraken.get_balance()
        assert len(rec.requests) == 2  # one retry
        assert any(b.asset == "ZUSD" for b in result.balances)

    def test_invalid_nonce_persists_raises(self) -> None:
        kraken, rec = _make_client({"error": ["EAPI:Invalid nonce"], "result": {}})
        with pytest.raises(InvalidNonceError):
            kraken.get_balance()
        assert len(rec.requests) == 2  # original + one retry


# ---------------------------------------------------------------------------
# Rate counter
# ---------------------------------------------------------------------------


class TestRateCounter:
    def test_decay(self) -> None:
        c = _RateCounter(cap=20.0, decay_per_sec=2.0)
        c.add(10.0)
        c.last_update -= 2.0  # simulate 2s elapsed
        assert c.current() == pytest.approx(6.0, abs=0.01)

    def test_ledger_paths_cost_more(self) -> None:
        assert _rest_cost("/0/private/TradesHistory") == 4.0
        assert _rest_cost("/0/private/Balance") == 1.0


# ---------------------------------------------------------------------------
# Public + private round-trips through mapping
# ---------------------------------------------------------------------------


class TestPublicMethods:
    def test_get_ticker(self) -> None:
        kraken, rec = _make_client(
            {
                "error": [],
                "result": {
                    "XXBTZUSD": {
                        "a": ["50000.0", "1", "1.0"],
                        "b": ["49999.0", "1", "1.0"],
                        "c": ["50000.5", "0.01"],
                        "v": ["10", "100"],
                        "p": ["49000", "49500"],
                        "t": [50, 500],
                        "l": ["48000", "47000"],
                        "h": ["51000", "52000"],
                        "o": "49000",
                    }
                },
            }
        )
        t = kraken.get_ticker("XBTUSD")
        assert t.ask == "50000.0"
        assert t.bid == "49999.0"
        assert t.last_trade_price == "50000.5"
        assert t.trade_count_24h == 500
        # Public endpoints are GET.
        assert rec.requests[-1].method == "GET"

    def test_get_asset_pairs(self) -> None:
        kraken, _ = _make_client(
            {
                "error": [],
                "result": {
                    "XXBTZUSD": {
                        "altname": "XBTUSD",
                        "wsname": "XBT/USD",
                        "base": "XXBT",
                        "quote": "ZUSD",
                        "pair_decimals": 1,
                        "lot_decimals": 8,
                        "ordermin": "0.0001",
                        "costmin": "0.5",
                        "status": "online",
                        "fees": [[0, 0.26]],
                        "fees_maker": [[0, 0.16]],
                    }
                },
            }
        )
        pairs = kraken.get_asset_pairs()
        assert len(pairs) == 1
        assert pairs[0].altname == "XBTUSD"
        assert pairs[0].taker_fee_percent == 0.26
        assert pairs[0].maker_fee_percent == 0.16


class TestOrderMethods:
    def test_add_order_builds_params_and_maps_receipt(self) -> None:
        kraken, rec = _make_client(
            {
                "error": [],
                "result": {
                    "txid": ["OABC-123"],
                    "descr": {"order": "buy 0.01 XBTUSD @ market"},
                },
            }
        )
        req = OrderRequest(
            pair="XBTUSD",
            side=OrderSide.BUY,
            ordertype=OrderType.MARKET,
            volume="0.01",
        )
        receipt = kraken.add_order(req)
        assert receipt.txid == ["OABC-123"]
        body = rec.requests[-1].content.decode()
        assert "pair=XBTUSD" in body
        assert "type=buy" in body
        assert "ordertype=market" in body
        assert "volume=0.01" in body

    def test_validate_order_sets_validate_flag(self) -> None:
        kraken, rec = _make_client(
            {"error": [], "result": {"descr": {"order": "validate"}, "txid": []}}
        )
        req = OrderRequest(
            pair="XBTUSD",
            side=OrderSide.SELL,
            ordertype=OrderType.LIMIT,
            volume="0.01",
            price="60000",
            validate_only=True,
        )
        kraken.validate_order(req)
        body = rec.requests[-1].content.decode()
        assert "validate=True" in body or "validate=true" in body.lower()

    def test_cancel_order(self) -> None:
        kraken, _ = _make_client({"error": [], "result": {"count": 1}})
        out = kraken.cancel_order("OABC-123")
        assert out == {"canceled": 1, "pending": False}


# ---------------------------------------------------------------------------
# Credential scrubber
# ---------------------------------------------------------------------------


class TestScrubber:
    def test_secret_redacted_in_logs(self, caplog) -> None:
        import logging

        from mangrove_markets.cex import client as client_mod

        KrakenHttpClient(api_key=TEST_KEY, api_secret=TEST_SECRET)
        with caplog.at_level(logging.WARNING, logger=client_mod.logger.name):
            client_mod.logger.warning("leaking secret %s and key %s", TEST_SECRET, TEST_KEY)
        joined = " ".join(r.getMessage() for r in caplog.records)
        assert TEST_SECRET not in joined
        assert TEST_KEY not in joined
        assert "***REDACTED***" in joined
