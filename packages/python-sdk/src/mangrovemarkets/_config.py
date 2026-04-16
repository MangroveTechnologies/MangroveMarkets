from __future__ import annotations

import os


DEFAULT_BASE_URL = "http://localhost:8080"
DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_RETRIES = 3


class ClientConfig:
    """Resolved SDK configuration.

    Resolution: explicit args > env vars > defaults.
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        auto_retry: bool = True,
    ) -> None:
        self.base_url = (base_url or os.environ.get("MANGROVE_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.api_key = api_key or os.environ.get("MANGROVE_API_KEY")
        self.timeout = timeout
        self.max_retries = max_retries
        self.auto_retry = auto_retry

    @property
    def tools_base_url(self) -> str:
        return f"{self.base_url}/api/v1"
