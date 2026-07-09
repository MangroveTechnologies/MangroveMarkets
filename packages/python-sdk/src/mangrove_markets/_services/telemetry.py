"""TelemetryService — emit trade records to the MangroveMarkets server.

Reuses the MCP-server transport (base + Mangrove-key Bearer auth) but targets
the dedicated telemetry routes, not the tool bridge:

    POST /api/v1/telemetry/trades
    GET  /api/v1/telemetry/trades

`user_id` is derived server-side from the Mangrove key — this client never
sends it.
"""
from __future__ import annotations

from typing import Any

from ..exceptions import APIError
from ..models.telemetry import TradeRecord
from ._base import BaseService


class TelemetryService(BaseService):
    _PATH = "/telemetry/trades"

    def report_trade(self, record: TradeRecord | dict[str, Any]) -> dict[str, Any]:
        payload = record.model_dump(mode="json") if isinstance(record, TradeRecord) else record
        resp = self._transport.request("POST", self._PATH, json=payload)
        data: dict[str, Any] = resp.json()
        if isinstance(data, dict) and data.get("error") is True:
            raise APIError(
                status_code=resp.status_code,
                error=str(data.get("error", "unknown_error")),
                message=str(data.get("message", "telemetry ingest failed")),
                code=str(data.get("code", "TELEMETRY_ERROR")),
                suggestion=data.get("suggestion"),
            )
        return data

    def report_trades(self, records: list[TradeRecord | dict[str, Any]]) -> list[dict[str, Any]]:
        return [self.report_trade(r) for r in records]

    def list_trades(self, limit: int = 50) -> dict[str, Any]:
        resp = self._transport.request("GET", self._PATH, params={"limit": limit})
        data: dict[str, Any] = resp.json()
        return data
