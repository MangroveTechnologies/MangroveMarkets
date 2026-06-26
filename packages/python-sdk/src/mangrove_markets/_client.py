from __future__ import annotations

from functools import cached_property
from typing import Any

from ._config import ClientConfig
from ._services.dex import DexService
from ._services.portfolio import PortfolioService
from ._services.wallet import WalletService
from ._transport._auth import ApiKeyAuth, AuthStrategy, NoAuth
from ._transport._http import HttpTransport
from ._transport._mock import MockTransport
from ._transport._retry import RetryConfig
from ._transport._service import ServiceTransport
from .cex import KrakenClient


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
            self._http = HttpTransport(
                timeout=timeout, retry_config=retry, httpx_client=httpx_client
            )

        auth: AuthStrategy = ApiKeyAuth(self._config.api_key) if self._config.api_key else NoAuth()
        self._transport = ServiceTransport(
            self._http, self._config.tools_base_url, auth
        )

    @cached_property
    def wallet(self) -> WalletService:
        return WalletService(self._transport)

    @cached_property
    def dex(self) -> DexService:
        return DexService(self._transport)

    @cached_property
    def portfolio(self) -> PortfolioService:
        return PortfolioService(self._transport)

    def cex(
        self,
        *,
        api_key: str,
        api_secret: str,
        base_url: str = "https://api.kraken.com",
        tier: str = "intermediate",
        timeout: float = 15.0,
    ) -> KrakenClient:
        """Construct a client-side Kraken client (bring your own key).

        CEX is **not** server-mediated. You supply your own Kraken API key and
        secret; the SDK signs locally and calls ``api.kraken.com`` directly. The
        key never touches any Mangrove service, so it is passed here rather than
        configured on the SDK client.

        Args:
            api_key: Your Kraken API key.
            api_secret: Your Kraken API private key (base64).
            base_url: Kraken REST base URL. Defaults to ``https://api.kraken.com``.
            tier: Kraken verification tier for rate-limit shaping.
            timeout: Per-request timeout in seconds.

        Raises:
            CredentialsRequiredError: if ``api_key`` or ``api_secret`` is missing.
        """
        return KrakenClient(
            api_key=api_key,
            api_secret=api_secret,
            base_url=base_url,
            tier=tier,
            timeout=timeout,
        )

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> MangroveMarkets:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
