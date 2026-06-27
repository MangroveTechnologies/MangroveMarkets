"""TelemetryService tests — emits TradeRecords to the server telemetry route."""
from __future__ import annotations

from datetime import datetime, timezone

from mangrove_markets import MangroveMarkets, TradeRecord
from mangrove_markets._transport._mock import MockTransport


def _record():
    return TradeRecord(
        id="kraken:T1", mode="live", status="confirmed", venue="kraken",
        venue_trade_ref="T1", side="buy", base="XXBTZUSD", qty=0.01,
        fill_price=64000.0, executed_at=datetime(2026, 6, 27, tzinfo=timezone.utc),
    )


def test_report_trade_posts_to_telemetry_route_with_bearer():
    mock = MockTransport()
    mock.add_response("POST", "/telemetry/trades",
                      json={"stored": True, "id": "kraken:T1", "user_id": "u_x"})
    client = MangroveMarkets(base_url="http://x", api_key="prod_abc", httpx_client=mock)

    out = client.telemetry.report_trade(_record())
    assert out["stored"] is True and out["user_id"] == "u_x"

    req = mock.requests[-1]
    assert req.method == "POST"
    assert req.url.endswith("/api/v1/telemetry/trades")
    assert req.headers.get("Authorization") == "Bearer prod_abc"   # Mangrove key
    assert req.json["venue"] == "kraken"
    assert req.json["venue_trade_ref"] == "T1"
    # client never asserts its own identity — server derives it
    assert req.json.get("user_id") is None


def test_report_trades_batch():
    mock = MockTransport()
    mock.add_response("POST", "/telemetry/trades", json={"stored": True})
    client = MangroveMarkets(base_url="http://x", api_key="k", httpx_client=mock)
    outs = client.telemetry.report_trades([_record(), _record()])
    assert len(outs) == 2
    assert sum(1 for r in mock.requests if r.method == "POST") == 2


def test_list_trades_gets_route():
    mock = MockTransport()
    mock.add_response("GET", "/telemetry/trades",
                      json={"user_id": "u_x", "count": 0, "trades": []})
    client = MangroveMarkets(base_url="http://x", api_key="k", httpx_client=mock)
    data = client.telemetry.list_trades(limit=10)
    assert data["count"] == 0
    assert mock.requests[-1].method == "GET"
