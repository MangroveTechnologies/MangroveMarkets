from __future__ import annotations

import re
from functools import cached_property
from typing import Any

from pydantic import ValidationError as ModelValidationError

from ._config import ClientConfig
from ._services.cex import CexService
from ._services.dex import DexService
from ._services.portfolio import PortfolioService
from ._services.telemetry import TelemetryService
from ._services.wallet import WalletService
from ._transport._auth import ApiKeyAuth, AuthStrategy, NoAuth
from ._transport._http import HttpTransport
from ._transport._mock import MockTransport
from ._transport._retry import RetryConfig
from ._transport._service import ServiceTransport
from .exceptions import MalformedResponseError
from .results import RESULT_FORMAT, RESULT_FORMAT_HEADER, ToolResponse, ToolResult


class MangroveMarkets:
    """MangroveMarkets Python SDK client.

    Args:
        base_url: MCP server base URL. Falls back to MANGROVE_BASE_URL env var,
            then localhost:8080.
        api_key: API key. Falls back to MANGROVE_API_KEY env var.
        timeout: Request timeout in seconds.
        max_retries: Max retry attempts on 429/5xx.
        auto_retry: Enable automatic retry with backoff.
        httpx_client: Inject a MockTransport or custom httpx.Client for testing.
    """

    def __init__(
        self,
        base_url: str | None = None,
        *,
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        auto_retry: bool = True,
        httpx_client: Any | None = None,
    ) -> None:
        self._config = ClientConfig(
            base_url=base_url,
            api_key=api_key,
            timeout=timeout,
            max_retries=max_retries,
            auto_retry=auto_retry,
        )
        retry = RetryConfig(max_retries=max_retries, auto_retry=auto_retry)

        if isinstance(httpx_client, MockTransport):
            self._http: Any = httpx_client
        else:
            self._http = HttpTransport(timeout=timeout, retry_config=retry, httpx_client=httpx_client)

        auth: AuthStrategy = ApiKeyAuth(self._config.api_key) if self._config.api_key else NoAuth()
        self._transport = ServiceTransport(self._http, self._config.tools_base_url, auth)

    @cached_property
    def wallet(self) -> WalletService:
        return WalletService(self._transport)

    @cached_property
    def dex(self) -> DexService:
        return DexService(self._transport)

    @cached_property
    def portfolio(self) -> PortfolioService:
        return PortfolioService(self._transport)

    @cached_property
    def telemetry(self) -> TelemetryService:
        """Emit/read trade records to the server (user_id derived from the key)."""
        return TelemetryService(self._transport)

    @cached_property
    def cex(self) -> CexService:
        """Keyless CEX (Kraken) access via the platform OAuth proxy — connect,
        balances, and orders on the user's OAuth-linked account, no venue key.
        (BYOK alternative: the top-level KrakenClient.)"""
        return CexService(self._transport)

    def close(self) -> None:
        self._http.close()

    def call_tool_result(self, name: str, arguments: dict[str, Any] | None = None) -> ToolResponse:
        """Get a complete tool result. Tool failures are returned in result.is_error.

        Requires a server supporting mcp-v1. A missing acknowledgement must not
        trigger an automatic replay: the original operation may have executed.
        """
        if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
            raise ValueError("Invalid tool name")
        if arguments is not None and not isinstance(arguments, dict):
            raise ValueError("Tool arguments must be a dictionary")
        response = self._transport.request(
            "POST",
            f"/tools/{name}",
            json=arguments or {},
            headers={RESULT_FORMAT_HEADER: RESULT_FORMAT},
            timeout=self._config.timeout,
        )
        headers = {key.lower(): value for key, value in response.headers.items()}
        if headers.get(RESULT_FORMAT_HEADER.lower()) != RESULT_FORMAT:
            raise MalformedResponseError(
                "Server did not acknowledge full results; do not automatically retry the operation",
                status_code=response.status_code,
                response_headers=headers,
                response_body=response.json(),
            )
        try:
            result = ToolResult.model_validate(response.json())
        except ModelValidationError:
            raise MalformedResponseError(
                "Malformed MCP tool response",
                status_code=response.status_code,
                response_headers=headers,
                response_body=response.json(),
            ) from None
        data = result.data()
        if any(isinstance(item, dict) and item.get("error") is True for item in (data, result.structured_content)):
            result.is_error = True
        return ToolResponse(result=result, status=response.status_code, headers=headers)

    def __enter__(self) -> MangroveMarkets:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
