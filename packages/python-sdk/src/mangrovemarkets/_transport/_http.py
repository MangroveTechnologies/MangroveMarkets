from __future__ import annotations

import logging
import sys
from typing import Any

import httpx

from .._version import __version__
from ..exceptions import (
    STATUS_CODE_EXCEPTIONS,
    APIError,
    ConnectionError,
    ServerError,
    TimeoutError,
)
from ._protocol import TransportResponse
from ._retry import RetryConfig

logger = logging.getLogger(__name__)


class HttpTransport:
    """Synchronous HTTP transport backed by httpx."""

    def __init__(
        self,
        *,
        timeout: float = 30.0,
        retry_config: RetryConfig | None = None,
        httpx_client: httpx.Client | None = None,
    ) -> None:
        self._retry = retry_config or RetryConfig()
        self._client = httpx_client or httpx.Client(
            timeout=timeout,
            headers={
                "Content-Type": "application/json",
                "User-Agent": (
                    f"mangrovemarkets-sdk/{__version__}"
                    f" python/{sys.version_info.major}.{sys.version_info.minor}"
                ),
            },
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
        last_error: Exception | None = None
        for attempt in range(self._retry.max_retries + 1):
            try:
                response = self._client.request(
                    method,
                    url,
                    headers=headers,
                    params=params,
                    json=json,
                    timeout=timeout,
                )
            except httpx.ConnectError as e:
                raise ConnectionError(f"Connection failed: {e}") from e
            except httpx.TimeoutException as e:
                raise TimeoutError(f"Request timed out: {e}") from e

            if response.status_code < 400:
                return TransportResponse(
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    data=response.json() if response.content else None,
                    text=response.text,
                )

            if self._retry.should_retry(response.status_code, attempt):
                last_error = self._build_error(response)
                retry_after = self._parse_retry_after(response)
                self._retry.wait(attempt, retry_after)
                continue

            raise self._build_error(response)

        if last_error is not None:
            raise last_error
        raise ServerError(500, "internal_error", "Max retries exceeded", "MAX_RETRIES")

    def close(self) -> None:
        self._client.close()

    def _build_error(self, response: httpx.Response) -> APIError:
        try:
            body = response.json()
            error = body.get("error", "unknown_error")
            message = body.get("message", response.text or "Unknown error")
            code = body.get("code", "UNKNOWN")
            suggestion = body.get("suggestion")
        except Exception:
            error = "unknown_error"
            message = response.text or "Unknown error"
            code = "UNKNOWN"
            suggestion = None
        exc_class = STATUS_CODE_EXCEPTIONS.get(response.status_code)
        if exc_class is None:
            exc_class = ServerError if response.status_code >= 500 else APIError
        return exc_class(
            status_code=response.status_code,
            error=error,
            message=message,
            code=code,
            suggestion=suggestion,
        )

    def _parse_retry_after(self, response: httpx.Response) -> int | None:
        header = response.headers.get("Retry-After")
        if header is not None:
            try:
                return int(header)
            except ValueError:
                pass
        return None
