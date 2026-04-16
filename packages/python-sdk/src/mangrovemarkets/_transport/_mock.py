from __future__ import annotations

import json as json_mod
from dataclasses import dataclass
from typing import Any

from ._protocol import TransportResponse


@dataclass
class RecordedRequest:
    method: str
    url: str
    headers: dict[str, str] | None = None
    params: dict[str, Any] | None = None
    json: Any | None = None


class MockTransport:
    def __init__(self) -> None:
        self._responses: list[tuple[str, str, int, Any, dict[str, str]]] = []
        self.requests: list[RecordedRequest] = []

    def add_response(
        self,
        method: str,
        path_pattern: str,
        *,
        status_code: int = 200,
        json: Any = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self._responses.append(
            (method.upper(), path_pattern, status_code, json, headers or {})
        )

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        timeout: float | None = None,
    ) -> TransportResponse:
        self.requests.append(
            RecordedRequest(
                method=method.upper(),
                url=url,
                headers=headers,
                params=params,
                json=json,
            )
        )
        for resp_method, pattern, status_code, resp_json, resp_headers in self._responses:
            if resp_method == method.upper() and pattern in url:
                text = json_mod.dumps(resp_json) if resp_json is not None else ""
                return TransportResponse(
                    status_code=status_code,
                    headers=resp_headers,
                    data=resp_json,
                    text=text,
                )
        return TransportResponse(
            status_code=404,
            headers={},
            data={
                "error": True,
                "code": "MOCK_NOT_FOUND",
                "message": f"No mock for {method} {url}",
            },
            text=json_mod.dumps(
                {
                    "error": True,
                    "code": "MOCK_NOT_FOUND",
                    "message": f"No mock for {method} {url}",
                }
            ),
        )

    def close(self) -> None:
        pass
