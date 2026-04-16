from __future__ import annotations

from typing import Any

from ._auth import AuthStrategy
from ._protocol import Transport, TransportResponse


class ServiceTransport:
    """Wraps a Transport with a base URL and auth strategy."""

    def __init__(
        self, transport: Transport, base_url: str, auth: AuthStrategy
    ) -> None:
        self._transport = transport
        self._base_url = base_url.rstrip("/")
        self._auth = auth

    def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
    ) -> TransportResponse:
        url = f"{self._base_url}{path}"
        merged_headers = dict(headers) if headers else {}
        merged_headers = self._auth.apply(merged_headers)
        return self._transport.request(
            method,
            url,
            headers=merged_headers,
            params=params,
            json=json,
            timeout=timeout,
        )

    @property
    def base_url(self) -> str:
        return self._base_url

    @base_url.setter
    def base_url(self, value: str) -> None:
        self._base_url = value.rstrip("/")

    def close(self) -> None:
        self._transport.close()
