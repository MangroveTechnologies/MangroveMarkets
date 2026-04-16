from __future__ import annotations

from typing import Any, Protocol


class TransportResponse:
    """Normalized response from the transport layer."""

    def __init__(
        self, status_code: int, headers: dict[str, str], data: Any, text: str
    ) -> None:
        self.status_code = status_code
        self.headers = headers
        self._data = data
        self._text = text

    def json(self) -> Any:
        return self._data

    @property
    def text(self) -> str:
        return self._text


class Transport(Protocol):
    """Protocol for HTTP transport layer. REST today, MCP later."""

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        timeout: float | None = None,
    ) -> TransportResponse: ...

    def close(self) -> None: ...
