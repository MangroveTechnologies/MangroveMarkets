# MangroveMarkets Python SDK — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `mangrovemarkets` to PyPI — a typed Python SDK for wallet, DEX, and portfolio operations against the MangroveMarkets MCP server.

**Architecture:** Mirrors `mangroveai` SDK (hatchling build, httpx sync transport, Pydantic v2 models, cached_property service loading, MockTransport for tests). Three services: `wallet`, `dex` (swap flow + market data), `portfolio` (cross-chain analytics). REST-only transport with protocol ABC for future MCP transport.

**Tech Stack:** Python 3.10+, httpx, Pydantic v2, hatchling, pytest, ruff, mypy

**Spec:** `docs/superpowers/specs/2026-04-15-python-sdk-pypi-design.md`

**Reference implementation:** `MangroveAI-SDK` at `github.com/MangroveTechnologies/MangroveAI-SDK`

---

## File Map

All paths relative to `packages/python-sdk/`.

| File | Responsibility | Task |
|---|---|---|
| `pyproject.toml` | Build config, deps, tool config | 1 |
| `src/mangrovemarkets/__init__.py` | Public API exports | 1 |
| `src/mangrovemarkets/_version.py` | Version string | 1 |
| `src/mangrovemarkets/_config.py` | ClientConfig resolution | 1 |
| `src/mangrovemarkets/exceptions.py` | Exception hierarchy | 2 |
| `src/mangrovemarkets/_transport/__init__.py` | Transport re-exports | 3 |
| `src/mangrovemarkets/_transport/_protocol.py` | Transport + TransportResponse protocol | 3 |
| `src/mangrovemarkets/_transport/_auth.py` | ApiKeyAuth, NoAuth, X402Auth | 3 |
| `src/mangrovemarkets/_transport/_retry.py` | RetryConfig | 3 |
| `src/mangrovemarkets/_transport/_http.py` | HttpTransport (httpx sync) | 3 |
| `src/mangrovemarkets/_transport/_mock.py` | MockTransport for tests | 3 |
| `src/mangrovemarkets/_transport/_service.py` | ServiceTransport (base_url + auth) | 3 |
| `tests/test_transport.py` | Transport + retry tests | 3 |
| `src/mangrovemarkets/models/__init__.py` | Model re-exports | 4 |
| `src/mangrovemarkets/models/_base.py` | MangroveModel base | 4 |
| `src/mangrovemarkets/models/wallet.py` | ChainInfo, WalletCreateResult | 4 |
| `src/mangrovemarkets/models/dex.py` | Venue, TradingPair, Quote, UnsignedTransaction, BroadcastResult, TxStatus | 4 |
| `src/mangrovemarkets/models/market_data.py` | Balances, SpotPrice, GasPrice, TokenInfo, TokenSearchResult, ChartData | 4 |
| `src/mangrovemarkets/models/portfolio.py` | PortfolioValue, PortfolioPnL, PortfolioTokens, PortfolioDefi, TxHistoryEntry | 4 |
| `src/mangrovemarkets/models/shared.py` | ToolResponse wrapper | 4 |
| `src/mangrovemarkets/_services/__init__.py` | Service re-exports | 5 |
| `src/mangrovemarkets/_services/_base.py` | BaseService with _request helpers | 5 |
| `src/mangrovemarkets/_services/wallet.py` | WalletService | 5 |
| `tests/test_wallet.py` | WalletService tests | 5 |
| `src/mangrovemarkets/_services/dex.py` | DexService (swap flow + market data) | 6 |
| `tests/test_dex.py` | DexService tests | 6 |
| `src/mangrovemarkets/_services/portfolio.py` | PortfolioService | 7 |
| `tests/test_portfolio.py` | PortfolioService tests | 7 |
| `src/mangrovemarkets/_client.py` | MangroveMarkets client class | 8 |
| `tests/test_client.py` | Client construction + service access tests | 8 |
| `src/mangrovemarkets/py.typed` | PEP 561 marker | 9 |
| `README.md` | Package README for PyPI | 9 |
| `examples/quickstart.py` | Basic usage example | 9 |
| `examples/swap_flow.py` | Full DEX swap example | 9 |
| `examples/portfolio_check.py` | Portfolio analytics example | 9 |
| `.github/workflows/python-sdk-ci.yml` | Test on PR | 10 |
| `.github/workflows/python-sdk-release.yml` | Publish to PyPI | 10 |

---

## Task 1: Project scaffold + pyproject.toml

**Files:**
- Delete: `packages/python-sdk/setup.py` (broken JSON file)
- Create: `packages/python-sdk/pyproject.toml`
- Create: `packages/python-sdk/src/mangrovemarkets/__init__.py`
- Create: `packages/python-sdk/src/mangrovemarkets/_version.py`
- Create: `packages/python-sdk/src/mangrovemarkets/_config.py`

- [ ] **Step 1: Delete the broken setup.py**

```bash
cd /Users/darrahts/mangrove-workspace/MangroveMarkets/packages/python-sdk
rm setup.py
```

- [ ] **Step 2: Delete existing stub files**

```bash
rm src/mangrovemarkets/client.py src/mangrovemarkets/models.py src/mangrovemarkets/exceptions.py
```

- [ ] **Step 3: Create pyproject.toml**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "mangrovemarkets"
version = "0.1.0"
description = "Python SDK for MangroveMarkets — DEX aggregation, wallet management, and portfolio analytics for agents"
readme = "README.md"
license = "MIT"
requires-python = ">=3.10"
authors = [
    {name = "Mangrove Technologies Inc."},
]
classifiers = [
    "Development Status :: 3 - Alpha",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Typing :: Typed",
]
dependencies = [
    "httpx>=0.27.0,<1.0",
    "pydantic>=2.0,<3.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-cov>=4.0",
    "ruff>=0.4",
    "mypy>=1.10",
]

[project.urls]
Homepage = "https://mangrovemarkets.com"
Repository = "https://github.com/MangroveTechnologies/MangroveMarkets"
Documentation = "https://github.com/MangroveTechnologies/MangroveMarkets/tree/main/packages/python-sdk#readme"
Changelog = "https://github.com/MangroveTechnologies/MangroveMarkets/blob/main/packages/python-sdk/CHANGELOG.md"

[tool.hatch.build.targets.wheel]
packages = ["src/mangrovemarkets"]

[tool.ruff]
target-version = "py310"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["E501"]

[tool.pytest.ini_options]
testpaths = ["tests"]
markers = [
    "integration: marks tests that hit a live server",
]

[tool.mypy]
python_version = "3.10"
strict = true
```

- [ ] **Step 4: Create _version.py**

```python
# src/mangrovemarkets/_version.py
__version__ = "0.1.0"
```

- [ ] **Step 5: Create _config.py**

```python
# src/mangrovemarkets/_config.py
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
```

- [ ] **Step 6: Create stub __init__.py**

```python
# src/mangrovemarkets/__init__.py
"""MangroveMarkets Python SDK.

Quickstart:
    from mangrovemarkets import MangroveMarkets

    client = MangroveMarkets(base_url="http://localhost:8080")
    venues = client.dex.supported_venues()
"""

from ._version import __version__

__all__ = ["__version__"]
```

- [ ] **Step 7: Verify package installs**

```bash
cd /Users/darrahts/mangrove-workspace/MangroveMarkets/packages/python-sdk
pip install -e ".[dev]"
python -c "import mangrovemarkets; print(mangrovemarkets.__version__)"
```

Expected: `0.1.0`

- [ ] **Step 8: Commit**

```bash
git add -A packages/python-sdk/
git commit -m "feat(python-sdk): scaffold pyproject.toml, config, version"
```

---

## Task 2: Exception hierarchy

**Files:**
- Create: `packages/python-sdk/src/mangrovemarkets/exceptions.py`

- [ ] **Step 1: Create exceptions.py**

```python
# src/mangrovemarkets/exceptions.py
from __future__ import annotations


class MangroveError(Exception):
    """Base exception for all MangroveMarkets SDK errors."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class APIError(MangroveError):
    """Server returned a non-2xx response."""

    def __init__(
        self,
        status_code: int,
        error: str,
        message: str,
        code: str,
        suggestion: str | None = None,
    ) -> None:
        self.status_code = status_code
        self.error = error
        self.code = code
        self.suggestion = suggestion
        super().__init__(message)

    def __str__(self) -> str:
        base = f"[{self.status_code}] {self.code}: {self.message}"
        if self.suggestion:
            base += f" (suggestion: {self.suggestion})"
        return base


class AuthenticationError(APIError):
    """401 Unauthorized."""


class ValidationError(APIError):
    """422 Unprocessable Entity."""


class NotFoundError(APIError):
    """404 Not Found."""


class RateLimitError(APIError):
    """429 Too Many Requests."""


class ServerError(APIError):
    """5xx Server Error."""


class ConnectionError(MangroveError):
    """Network-level connection failure."""


class TimeoutError(MangroveError):
    """Request timeout."""


class ConfigurationError(MangroveError):
    """Invalid SDK configuration."""


class NotImplementedOnServer(MangroveError):
    """Server tool exists but is not yet implemented (returns NOT_IMPLEMENTED)."""


STATUS_CODE_EXCEPTIONS: dict[int, type[APIError]] = {
    401: AuthenticationError,
    404: NotFoundError,
    422: ValidationError,
    429: RateLimitError,
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/python-sdk/src/mangrovemarkets/exceptions.py
git commit -m "feat(python-sdk): exception hierarchy matching MCP server error format"
```

---

## Task 3: Transport layer

**Files:**
- Create: `packages/python-sdk/src/mangrovemarkets/_transport/__init__.py`
- Create: `packages/python-sdk/src/mangrovemarkets/_transport/_protocol.py`
- Create: `packages/python-sdk/src/mangrovemarkets/_transport/_auth.py`
- Create: `packages/python-sdk/src/mangrovemarkets/_transport/_retry.py`
- Create: `packages/python-sdk/src/mangrovemarkets/_transport/_http.py`
- Create: `packages/python-sdk/src/mangrovemarkets/_transport/_mock.py`
- Create: `packages/python-sdk/src/mangrovemarkets/_transport/_service.py`
- Create: `packages/python-sdk/tests/__init__.py`
- Create: `packages/python-sdk/tests/conftest.py`
- Create: `packages/python-sdk/tests/test_transport.py`

- [ ] **Step 1: Write transport tests**

```python
# tests/test_transport.py
from __future__ import annotations

import pytest

from mangrovemarkets._transport._auth import ApiKeyAuth, NoAuth
from mangrovemarkets._transport._mock import MockTransport
from mangrovemarkets._transport._retry import RetryConfig
from mangrovemarkets._transport._service import ServiceTransport
from mangrovemarkets.exceptions import AuthenticationError, NotFoundError, ServerError


class TestRetryConfig:
    def test_should_retry_on_429(self) -> None:
        config = RetryConfig(max_retries=3, auto_retry=True)
        assert config.should_retry(429, 0) is True

    def test_should_not_retry_on_400(self) -> None:
        config = RetryConfig(max_retries=3, auto_retry=True)
        assert config.should_retry(400, 0) is False

    def test_should_not_retry_when_disabled(self) -> None:
        config = RetryConfig(max_retries=3, auto_retry=False)
        assert config.should_retry(429, 0) is False

    def test_should_not_retry_past_max(self) -> None:
        config = RetryConfig(max_retries=2, auto_retry=True)
        assert config.should_retry(429, 2) is False

    def test_wait_time_exponential(self) -> None:
        config = RetryConfig()
        t0 = config.wait_time(0)
        t1 = config.wait_time(1)
        assert 1.0 <= t0 <= 1.5
        assert 2.0 <= t1 <= 3.0

    def test_wait_time_respects_retry_after(self) -> None:
        config = RetryConfig()
        assert config.wait_time(0, retry_after=10) == 10.0


class TestAuth:
    def test_api_key_auth_sets_bearer(self) -> None:
        auth = ApiKeyAuth("test-key-123")
        headers = auth.apply({})
        assert headers["Authorization"] == "Bearer test-key-123"

    def test_no_auth_passes_through(self) -> None:
        auth = NoAuth()
        headers = auth.apply({"Existing": "header"})
        assert headers == {"Existing": "header"}


class TestMockTransport:
    def test_returns_canned_response(self) -> None:
        mock = MockTransport()
        mock.add_response("GET", "/health", json={"status": "ok"})
        resp = mock.request("GET", "http://localhost/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_records_requests(self) -> None:
        mock = MockTransport()
        mock.add_response("POST", "/tools/wallet_create", json={"address": "r..."})
        mock.request("POST", "http://localhost/tools/wallet_create", json={"chain": "xrpl"})
        assert len(mock.requests) == 1
        assert mock.requests[0].json == {"chain": "xrpl"}

    def test_returns_404_when_no_match(self) -> None:
        mock = MockTransport()
        resp = mock.request("GET", "http://localhost/unknown")
        assert resp.status_code == 404


class TestServiceTransport:
    def test_prepends_base_url(self) -> None:
        mock = MockTransport()
        mock.add_response("POST", "/api/v1/tools/wallet_chain_info", json={"chain": "xrpl"})
        svc = ServiceTransport(mock, "http://localhost/api/v1", NoAuth())
        resp = svc.request("POST", "/tools/wallet_chain_info")
        assert resp.json() == {"chain": "xrpl"}
        assert "http://localhost/api/v1/tools/wallet_chain_info" in mock.requests[0].url

    def test_applies_auth_headers(self) -> None:
        mock = MockTransport()
        mock.add_response("POST", "/tools/test", json={})
        svc = ServiceTransport(mock, "http://localhost/api/v1", ApiKeyAuth("my-key"))
        svc.request("POST", "/tools/test")
        assert mock.requests[0].headers["Authorization"] == "Bearer my-key"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/darrahts/mangrove-workspace/MangroveMarkets/packages/python-sdk
pytest tests/test_transport.py -v
```

Expected: FAIL (modules don't exist yet)

- [ ] **Step 3: Create _protocol.py**

```python
# src/mangrovemarkets/_transport/_protocol.py
from __future__ import annotations

from typing import Any, Protocol


class TransportResponse:
    """Normalized response from the transport layer."""

    def __init__(self, status_code: int, headers: dict[str, str], data: Any, text: str) -> None:
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
```

- [ ] **Step 4: Create _auth.py**

```python
# src/mangrovemarkets/_transport/_auth.py
from __future__ import annotations

from typing import Protocol


class AuthStrategy(Protocol):
    """Strategy for applying authentication to request headers."""

    def apply(self, headers: dict[str, str]) -> dict[str, str]: ...


class ApiKeyAuth:
    """Authorization: Bearer {api_key}"""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def apply(self, headers: dict[str, str]) -> dict[str, str]:
        headers["Authorization"] = f"Bearer {self._api_key}"
        return headers


class NoAuth:
    """No authentication headers."""

    def apply(self, headers: dict[str, str]) -> dict[str, str]:
        return headers
```

- [ ] **Step 5: Create _retry.py**

```python
# src/mangrovemarkets/_transport/_retry.py
from __future__ import annotations

import logging
import random
import time

logger = logging.getLogger(__name__)


class RetryConfig:
    """Retry configuration with exponential backoff and jitter."""

    def __init__(self, max_retries: int = 3, auto_retry: bool = True) -> None:
        self.max_retries = max_retries
        self.auto_retry = auto_retry

    def should_retry(self, status_code: int, attempt: int) -> bool:
        if not self.auto_retry or attempt >= self.max_retries:
            return False
        return status_code in (429, 502, 503, 504)

    def wait_time(self, attempt: int, retry_after: int | None = None) -> float:
        if retry_after is not None:
            return float(retry_after)
        base = min(2 ** attempt, 30)
        jitter = random.uniform(0, base * 0.5)
        return base + jitter

    def wait(self, attempt: int, retry_after: int | None = None) -> None:
        wait = self.wait_time(attempt, retry_after)
        logger.debug("Retrying in %.1fs (attempt %d/%d)", wait, attempt + 1, self.max_retries)
        time.sleep(wait)
```

- [ ] **Step 6: Create _http.py**

```python
# src/mangrovemarkets/_transport/_http.py
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
                "User-Agent": f"mangrovemarkets-sdk/{__version__} python/{sys.version_info.major}.{sys.version_info.minor}",
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
                    method, url, headers=headers, params=params, json=json, timeout=timeout,
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
        return exc_class(status_code=response.status_code, error=error, message=message, code=code, suggestion=suggestion)

    def _parse_retry_after(self, response: httpx.Response) -> int | None:
        header = response.headers.get("Retry-After")
        if header is not None:
            try:
                return int(header)
            except ValueError:
                pass
        return None
```

- [ ] **Step 7: Create _mock.py**

```python
# src/mangrovemarkets/_transport/_mock.py
from __future__ import annotations

import json as json_mod
from dataclasses import dataclass, field
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
    """Transport that records requests and returns canned responses.

    Usage:
        mock = MockTransport()
        mock.add_response("GET", "/health", json={"status": "ok"})
        client = MangroveMarkets(base_url="http://test", httpx_client=mock)
    """

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
        self._responses.append((method.upper(), path_pattern, status_code, json, headers or {}))

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
        self.requests.append(RecordedRequest(method=method.upper(), url=url, headers=headers, params=params, json=json))

        for resp_method, pattern, status_code, resp_json, resp_headers in self._responses:
            if resp_method == method.upper() and pattern in url:
                text = json_mod.dumps(resp_json) if resp_json is not None else ""
                return TransportResponse(status_code=status_code, headers=resp_headers, data=resp_json, text=text)

        return TransportResponse(
            status_code=404,
            headers={},
            data={"error": True, "code": "MOCK_NOT_FOUND", "message": f"No mock for {method} {url}"},
            text=json_mod.dumps({"error": True, "code": "MOCK_NOT_FOUND", "message": f"No mock for {method} {url}"}),
        )

    def close(self) -> None:
        pass
```

- [ ] **Step 8: Create _service.py**

```python
# src/mangrovemarkets/_transport/_service.py
from __future__ import annotations

from typing import Any

from ._auth import AuthStrategy
from ._protocol import Transport, TransportResponse


class ServiceTransport:
    """Wraps a Transport with a base URL and auth strategy."""

    def __init__(self, transport: Transport, base_url: str, auth: AuthStrategy) -> None:
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
        return self._transport.request(method, url, headers=merged_headers, params=params, json=json, timeout=timeout)

    @property
    def base_url(self) -> str:
        return self._base_url

    @base_url.setter
    def base_url(self, value: str) -> None:
        self._base_url = value.rstrip("/")

    def close(self) -> None:
        self._transport.close()
```

- [ ] **Step 9: Create _transport/__init__.py**

```python
# src/mangrovemarkets/_transport/__init__.py
from ._mock import MockTransport
from ._protocol import Transport, TransportResponse
from ._service import ServiceTransport

__all__ = ["MockTransport", "ServiceTransport", "Transport", "TransportResponse"]
```

- [ ] **Step 10: Create tests/__init__.py and conftest.py**

```python
# tests/__init__.py
```

```python
# tests/conftest.py
from __future__ import annotations

from mangrovemarkets._transport._mock import MockTransport


def make_mock() -> MockTransport:
    """Create a fresh MockTransport."""
    return MockTransport()
```

- [ ] **Step 11: Run tests**

```bash
pytest tests/test_transport.py -v
```

Expected: all PASS

- [ ] **Step 12: Commit**

```bash
git add packages/python-sdk/src/mangrovemarkets/_transport/ packages/python-sdk/tests/
git commit -m "feat(python-sdk): transport layer (protocol, http, mock, retry, auth)"
```

---

## Task 4: Pydantic models

**Files:**
- Create: `packages/python-sdk/src/mangrovemarkets/models/__init__.py`
- Create: `packages/python-sdk/src/mangrovemarkets/models/_base.py`
- Create: `packages/python-sdk/src/mangrovemarkets/models/shared.py`
- Create: `packages/python-sdk/src/mangrovemarkets/models/wallet.py`
- Create: `packages/python-sdk/src/mangrovemarkets/models/dex.py`
- Create: `packages/python-sdk/src/mangrovemarkets/models/market_data.py`
- Create: `packages/python-sdk/src/mangrovemarkets/models/portfolio.py`

- [ ] **Step 1: Create _base.py**

```python
# src/mangrovemarkets/models/_base.py
from pydantic import BaseModel, ConfigDict


class MangroveModel(BaseModel):
    """Base model for all MangroveMarkets SDK models."""

    model_config = ConfigDict(extra="allow")
```

- [ ] **Step 2: Create shared.py**

```python
# src/mangrovemarkets/models/shared.py
from __future__ import annotations

from typing import Any

from ._base import MangroveModel


class ToolResponse(MangroveModel):
    """Wrapper for MCP tool REST responses."""

    success: bool = True
    data: Any = None
    error: bool = False
    code: str | None = None
    message: str | None = None
    suggestion: str | None = None
```

- [ ] **Step 3: Create wallet.py**

```python
# src/mangrovemarkets/models/wallet.py
from __future__ import annotations

from typing import Any

from ._base import MangroveModel


class ChainInfo(MangroveModel):
    """Chain configuration from wallet_chain_info."""

    chain: str
    chain_family: str
    native_token: str
    wallet_creation: str
    supported_chain_ids: list[int] | None = None
    networks: dict[str, Any] | None = None
    sdk_method: str | None = None


class WalletCreateResult(MangroveModel):
    """Result of wallet_create. Secrets returned once at creation only."""

    address: str
    secret: str | None = None          # XRPL seed
    private_key: str | None = None     # EVM private key (hex)
    seed_phrase: str | None = None     # XRPL seed phrase
    chain: str = "xrpl"
    chain_id: int | None = None
    network: str = "testnet"
    is_funded: bool = False
    warnings: list[str] | None = None
```

- [ ] **Step 4: Create dex.py**

```python
# src/mangrovemarkets/models/dex.py
from __future__ import annotations

from typing import Any

from ._base import MangroveModel


class Venue(MangroveModel):
    """DEX venue descriptor."""

    id: str
    name: str
    chain: str
    status: str = "active"
    supported_pairs_count: int = 0
    fee_percent: float = 0.0


class TradingPair(MangroveModel):
    """Supported trading pair on a venue."""

    venue_id: str
    base_token: str
    quote_token: str
    min_amount: float | None = None
    max_amount: float | None = None
    is_active: bool = True


class Quote(MangroveModel):
    """Quote from dex_get_quote."""

    quote_id: str
    venue_id: str
    input_token: str
    output_token: str
    input_amount: float
    output_amount: float
    exchange_rate: float
    price_impact_percent: float = 0.0
    venue_fee: float = 0.0
    mangrove_fee: float = 0.0
    total_cost: float = 0.0
    expires_at: str | None = None
    chain_id: int | None = None
    billing_mode: str | None = None
    routes: list[Any] | None = None


class UnsignedTransaction(MangroveModel):
    """Unsigned tx data from dex_prepare_swap or dex_approve_token.

    The agent signs this locally. The SDK never sees private keys.
    """

    chain_family: str
    chain_id: int | None = None
    venue_id: str
    description: str
    payload: dict[str, Any]
    estimated_gas: str | None = None
    expires_at: str | None = None


class BroadcastResult(MangroveModel):
    """Result from dex_broadcast."""

    tx_hash: str
    chain_family: str
    chain_id: int | None = None
    venue_id: str
    broadcast_method: str = "public"


class TransactionStatus(MangroveModel):
    """On-chain status from dex_tx_status."""

    tx_hash: str
    chain_family: str
    chain_id: int | None = None
    status: str  # "pending", "confirmed", "failed", "not_found"
    block_number: int | None = None
    confirmations: int | None = None
    gas_used: str | None = None
    error_message: str | None = None
```

- [ ] **Step 5: Create market_data.py**

```python
# src/mangrovemarkets/models/market_data.py
from __future__ import annotations

from typing import Any

from ._base import MangroveModel


class Balances(MangroveModel):
    """Token balances from oneinch_balances."""

    chain_id: int
    wallet: str
    balances: dict[str, str]


class SpotPrice(MangroveModel):
    """Spot prices from oneinch_spot_price."""

    chain_id: int
    prices: dict[str, str]


class GasPrice(MangroveModel):
    """Gas prices from oneinch_gas_price."""

    chain_id: int
    low: str | None = None
    medium: str | None = None
    high: str | None = None
    base_fee: str | None = None


class TokenSearchResult(MangroveModel):
    """Single token from oneinch_token_search."""

    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: str | None = None
    chain_id: int | None = None


class TokenInfo(MangroveModel):
    """Detailed token info from oneinch_token_info."""

    address: str
    symbol: str
    name: str
    decimals: int
    logo_uri: str | None = None
    chain_id: int | None = None
    price_usd: str | None = None
    tags: list[str] | None = None


class Allowance(MangroveModel):
    """Token allowance from oneinch_allowances."""

    token: str
    allowance: str


class ChartCandle(MangroveModel):
    """Single OHLCV candle."""

    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None
```

- [ ] **Step 6: Create portfolio.py**

```python
# src/mangrovemarkets/models/portfolio.py
from __future__ import annotations

from typing import Any

from ._base import MangroveModel


class PortfolioValue(MangroveModel):
    """Total portfolio value from oneinch_portfolio_value."""

    total_value_usd: float | None = None
    chains: dict[str, Any] | None = None


class PortfolioPnL(MangroveModel):
    """Portfolio P&L from oneinch_portfolio_pnl."""

    total_pnl_usd: float | None = None
    chains: dict[str, Any] | None = None


class PortfolioTokens(MangroveModel):
    """Token holdings from oneinch_portfolio_tokens."""

    tokens: list[dict[str, Any]] | None = None


class PortfolioDefi(MangroveModel):
    """DeFi positions from oneinch_portfolio_defi."""

    positions: list[dict[str, Any]] | None = None


class TxHistoryEntry(MangroveModel):
    """Single transaction from oneinch_history."""

    tx_hash: str
    chain_id: int | None = None
    block_number: int | None = None
    timestamp: str | None = None
    from_address: str | None = None
    to_address: str | None = None
    value: str | None = None
    status: str | None = None
```

- [ ] **Step 7: Create models/__init__.py**

```python
# src/mangrovemarkets/models/__init__.py
from .dex import BroadcastResult, Quote, TradingPair, TransactionStatus, UnsignedTransaction, Venue
from .market_data import Allowance, Balances, ChartCandle, GasPrice, SpotPrice, TokenInfo, TokenSearchResult
from .portfolio import PortfolioDefi, PortfolioPnL, PortfolioTokens, PortfolioValue, TxHistoryEntry
from .shared import ToolResponse
from .wallet import ChainInfo, WalletCreateResult

__all__ = [
    "Allowance",
    "Balances",
    "BroadcastResult",
    "ChainInfo",
    "ChartCandle",
    "GasPrice",
    "PortfolioDefi",
    "PortfolioPnL",
    "PortfolioTokens",
    "PortfolioValue",
    "Quote",
    "SpotPrice",
    "TokenInfo",
    "TokenSearchResult",
    "ToolResponse",
    "TradingPair",
    "TransactionStatus",
    "TxHistoryEntry",
    "UnsignedTransaction",
    "Venue",
    "WalletCreateResult",
]
```

- [ ] **Step 8: Verify models import cleanly**

```bash
python -c "from mangrovemarkets.models import Quote, WalletCreateResult, PortfolioValue; print('OK')"
```

Expected: `OK`

- [ ] **Step 9: Commit**

```bash
git add packages/python-sdk/src/mangrovemarkets/models/
git commit -m "feat(python-sdk): Pydantic v2 models for wallet, dex, market data, portfolio"
```

---

## Task 5: BaseService + WalletService

**Files:**
- Create: `packages/python-sdk/src/mangrovemarkets/_services/__init__.py`
- Create: `packages/python-sdk/src/mangrovemarkets/_services/_base.py`
- Create: `packages/python-sdk/src/mangrovemarkets/_services/wallet.py`
- Create: `packages/python-sdk/tests/test_wallet.py`

- [ ] **Step 1: Write wallet tests**

```python
# tests/test_wallet.py
from __future__ import annotations

from mangrovemarkets._transport._auth import NoAuth
from mangrovemarkets._transport._mock import MockTransport
from mangrovemarkets._transport._service import ServiceTransport
from mangrovemarkets.models.wallet import ChainInfo, WalletCreateResult


def _make_service() -> tuple[MockTransport, "WalletService"]:
    from mangrovemarkets._services.wallet import WalletService
    mock = MockTransport()
    transport = ServiceTransport(mock, "http://test/api/v1", NoAuth())
    return mock, WalletService(transport)


class TestChainInfo:
    def test_returns_chain_info(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/wallet_chain_info", json={
            "chain": "evm",
            "chain_family": "evm",
            "native_token": "ETH",
            "wallet_creation": "client_side_only",
            "supported_chain_ids": [1, 8453],
        })
        result = svc.chain_info(chain="evm")
        assert isinstance(result, ChainInfo)
        assert result.chain == "evm"
        assert result.native_token == "ETH"
        assert mock.requests[0].json == {"chain": "evm"}


class TestWalletCreate:
    def test_create_xrpl_wallet(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/wallet_create", json={
            "address": "r4Vx2CdzRwHQHqGCUgDjTqa8PoFRdJjPuJ",
            "secret": "sEdV...",
            "network": "testnet",
            "chain": "xrpl",
            "is_funded": True,
            "warnings": ["IMPORTANT: Save your wallet secret now"],
        })
        result = svc.create(chain="xrpl", network="testnet")
        assert isinstance(result, WalletCreateResult)
        assert result.address.startswith("r")
        assert result.is_funded is True
        assert mock.requests[0].json == {"chain": "xrpl", "network": "testnet"}

    def test_create_evm_wallet(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/wallet_create", json={
            "address": "0xbf57B1ACf74885e215617783Fad4aE4DF849A8d0",
            "private_key": "0x4f9010df...",
            "chain": "evm",
            "chain_id": 8453,
            "network": "evm",
            "is_funded": False,
        })
        result = svc.create(chain="evm", chain_id=8453)
        assert result.address.startswith("0x")
        assert result.private_key is not None
        assert result.chain_id == 8453
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_wallet.py -v
```

Expected: FAIL

- [ ] **Step 3: Create _base.py**

```python
# src/mangrovemarkets/_services/_base.py
from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel

from .._transport._service import ServiceTransport

T = TypeVar("T", bound=BaseModel)

TOOLS_PATH = "/tools"


class BaseService:
    """Base class for all service implementations."""

    def __init__(self, transport: ServiceTransport) -> None:
        self._transport = transport

    def _call_tool(self, tool_name: str, params: dict[str, Any] | None = None) -> Any:
        """Call an MCP tool via the REST bridge."""
        response = self._transport.request("POST", f"{TOOLS_PATH}/{tool_name}", json=params or {})
        return response.json()

    def _call_tool_model(self, tool_name: str, model: type[T], params: dict[str, Any] | None = None) -> T:
        """Call a tool and parse the response into a Pydantic model."""
        data = self._call_tool(tool_name, params)
        return model.model_validate(data)
```

- [ ] **Step 4: Create wallet.py service**

```python
# src/mangrovemarkets/_services/wallet.py
from __future__ import annotations

from ..models.wallet import ChainInfo, WalletCreateResult
from ._base import BaseService


class WalletService(BaseService):
    """Wallet management operations."""

    def chain_info(self, chain: str = "xrpl") -> ChainInfo:
        """Get chain configuration. Use before creating a wallet."""
        return self._call_tool_model("wallet_chain_info", ChainInfo, {"chain": chain})

    def create(
        self,
        chain: str = "xrpl",
        network: str = "testnet",
        chain_id: int | None = None,
    ) -> WalletCreateResult:
        """Create a new wallet. Secrets are returned once and never stored."""
        params: dict = {"chain": chain, "network": network}
        if chain_id is not None:
            params["chain_id"] = chain_id
        return self._call_tool_model("wallet_create", WalletCreateResult, params)

    def balance(self, address: str, chain: str = "xrpl") -> Any:
        """Check wallet balance. NOT_IMPLEMENTED on server (Phase 1)."""
        raise NotImplementedOnServer("wallet_balance is not yet implemented on the server (Phase 1)")

    def transactions(self, address: str, chain: str = "xrpl", limit: int = 50) -> Any:
        """List wallet transactions. NOT_IMPLEMENTED on server (Phase 1)."""
        raise NotImplementedOnServer("wallet_transactions is not yet implemented on the server (Phase 1)")
```

Note: add `from ..exceptions import NotImplementedOnServer` to the imports at the top of wallet.py.

- [ ] **Step 5: Create _services/__init__.py**

```python
# src/mangrovemarkets/_services/__init__.py
from .wallet import WalletService

__all__ = ["WalletService"]
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/test_wallet.py -v
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add packages/python-sdk/src/mangrovemarkets/_services/ packages/python-sdk/tests/test_wallet.py
git commit -m "feat(python-sdk): BaseService + WalletService with tests"
```

---

## Task 6: DexService (swap flow + market data)

**Files:**
- Create: `packages/python-sdk/src/mangrovemarkets/_services/dex.py`
- Create: `packages/python-sdk/tests/test_dex.py`

- [ ] **Step 1: Write DEX tests**

```python
# tests/test_dex.py
from __future__ import annotations

from mangrovemarkets._transport._auth import NoAuth
from mangrovemarkets._transport._mock import MockTransport
from mangrovemarkets._transport._service import ServiceTransport
from mangrovemarkets.models.dex import (
    BroadcastResult,
    Quote,
    TradingPair,
    TransactionStatus,
    UnsignedTransaction,
    Venue,
)
from mangrovemarkets.models.market_data import Balances, ChartCandle, GasPrice, SpotPrice, TokenInfo, TokenSearchResult


def _make_service() -> tuple[MockTransport, "DexService"]:
    from mangrovemarkets._services.dex import DexService
    mock = MockTransport()
    transport = ServiceTransport(mock, "http://test/api/v1", NoAuth())
    return mock, DexService(transport)


class TestSupportedVenues:
    def test_returns_venue_list(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/dex_supported_venues", json={
            "venues": [
                {"id": "1inch", "name": "1inch Aggregator", "chain": "multi", "status": "active", "supported_pairs_count": 3, "fee_percent": 0.0025},
                {"id": "xpmarket", "name": "XPMarket", "chain": "xrpl-testnet", "status": "active", "supported_pairs_count": 2, "fee_percent": 0.001},
            ]
        })
        result = svc.supported_venues()
        assert len(result) == 2
        assert isinstance(result[0], Venue)
        assert result[0].id == "1inch"


class TestGetQuote:
    def test_returns_quote(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/dex_get_quote", json={
            "quote_id": "1inch-a1b2c3",
            "venue_id": "1inch",
            "input_token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "output_token": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            "input_amount": 1000000,
            "output_amount": 459244868977722,
            "exchange_rate": 4.59e-7,
            "chain_id": 8453,
        })
        result = svc.get_quote(
            input_token="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            output_token="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            amount=1000000,
            chain_id=8453,
        )
        assert isinstance(result, Quote)
        assert result.quote_id == "1inch-a1b2c3"
        assert result.chain_id == 8453


class TestPrepareSwap:
    def test_returns_unsigned_tx(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/dex_prepare_swap", json={
            "chain_family": "evm",
            "chain_id": 8453,
            "venue_id": "1inch",
            "description": "Swap USDC for ETH via 1inch on chain 8453",
            "payload": {"to": "0x111...", "data": "0x12aa...", "value": "0", "gas": 234948},
            "estimated_gas": "234948",
        })
        result = svc.prepare_swap(quote_id="1inch-a1b2c3", wallet_address="0xbf5...")
        assert isinstance(result, UnsignedTransaction)
        assert result.chain_family == "evm"
        assert "to" in result.payload


class TestBroadcast:
    def test_returns_broadcast_result(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/dex_broadcast", json={
            "tx_hash": "0xc29ac8f7...",
            "chain_family": "evm",
            "chain_id": 8453,
            "venue_id": "1inch",
            "broadcast_method": "public",
        })
        result = svc.broadcast(signed_tx="0xabc...", chain_id=8453)
        assert isinstance(result, BroadcastResult)
        assert result.tx_hash == "0xc29ac8f7..."


class TestTxStatus:
    def test_returns_status(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/dex_tx_status", json={
            "tx_hash": "0xc29ac8f7...",
            "chain_family": "evm",
            "chain_id": 8453,
            "status": "confirmed",
            "block_number": 12345678,
            "gas_used": "150000",
        })
        result = svc.tx_status(tx_hash="0xc29ac8f7...", chain_id=8453)
        assert isinstance(result, TransactionStatus)
        assert result.status == "confirmed"


class TestBalances:
    def test_returns_balances(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/oneinch_balances", json={
            "chain_id": 8453,
            "wallet": "0xbf5...",
            "balances": {"0xeeee...": "5470648682909640", "0x8335...": "9000000"},
        })
        result = svc.balances(chain_id=8453, wallet="0xbf5...")
        assert isinstance(result, Balances)
        assert len(result.balances) == 2


class TestSpotPrice:
    def test_returns_prices(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/oneinch_spot_price", json={
            "chain_id": 8453,
            "prices": {"0x833...": "1.0001"},
        })
        result = svc.spot_price(chain_id=8453, tokens="0x833...")
        assert isinstance(result, SpotPrice)


class TestGasPrice:
    def test_returns_gas(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/oneinch_gas_price", json={
            "chain_id": 8453,
            "low": "100000",
            "medium": "150000",
            "high": "200000",
        })
        result = svc.gas_price(chain_id=8453)
        assert isinstance(result, GasPrice)
        assert result.medium == "150000"


class TestTokenSearch:
    def test_returns_tokens(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/oneinch_token_search", json={
            "tokens": [
                {"address": "0x833...", "symbol": "USDC", "name": "USD Coin", "decimals": 6},
            ]
        })
        result = svc.token_search(chain_id=8453, query="USDC")
        assert len(result) == 1
        assert isinstance(result[0], TokenSearchResult)
        assert result[0].symbol == "USDC"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_dex.py -v
```

Expected: FAIL

- [ ] **Step 3: Create dex.py service**

```python
# src/mangrovemarkets/_services/dex.py
from __future__ import annotations

from typing import Any

from ..models.dex import BroadcastResult, Quote, TradingPair, TransactionStatus, UnsignedTransaction, Venue
from ..models.market_data import Allowance, Balances, ChartCandle, GasPrice, SpotPrice, TokenInfo, TokenSearchResult
from ._base import BaseService


class DexService(BaseService):
    """DEX swap operations and market data utilities."""

    # -- Swap flow --

    def supported_venues(self) -> list[Venue]:
        """List all supported DEX venues."""
        data = self._call_tool("dex_supported_venues")
        return [Venue.model_validate(v) for v in data["venues"]]

    def supported_pairs(self, venue_id: str) -> list[TradingPair]:
        """List supported trading pairs for a venue."""
        data = self._call_tool("dex_supported_pairs", {"venue_id": venue_id})
        return [TradingPair.model_validate(p) for p in data["pairs"]]

    def get_quote(
        self,
        input_token: str,
        output_token: str,
        amount: float,
        venue_id: str | None = None,
        chain_id: int | None = None,
        mode: str | None = None,
    ) -> Quote:
        """Get a swap quote. Omit venue_id for best across all venues."""
        params: dict[str, Any] = {"input_token": input_token, "output_token": output_token, "amount": amount}
        if venue_id is not None:
            params["venue_id"] = venue_id
        if chain_id is not None:
            params["chain_id"] = chain_id
        if mode is not None:
            params["mode"] = mode
        return self._call_tool_model("dex_get_quote", Quote, params)

    def approve_token(
        self,
        token_address: str,
        chain_id: int,
        wallet_address: str,
        amount: float | None = None,
    ) -> UnsignedTransaction | None:
        """Get unsigned ERC-20 approval calldata. Not needed for native tokens or non-EVM chains."""
        params: dict[str, Any] = {"token_address": token_address, "chain_id": chain_id, "wallet_address": wallet_address}
        if amount is not None:
            params["amount"] = amount
        data = self._call_tool("dex_approve_token", params)
        if data is None:
            return None
        return UnsignedTransaction.model_validate(data)

    def prepare_swap(
        self,
        quote_id: str,
        wallet_address: str,
        slippage: float = 1.0,
    ) -> UnsignedTransaction:
        """Get unsigned swap calldata for a quote. Agent signs locally."""
        return self._call_tool_model("dex_prepare_swap", UnsignedTransaction, {
            "quote_id": quote_id, "wallet_address": wallet_address, "slippage": slippage,
        })

    def broadcast(
        self,
        signed_tx: str,
        chain_id: int,
        venue_id: str | None = None,
        mev_protection: bool = False,
    ) -> BroadcastResult:
        """Broadcast a locally-signed transaction."""
        params: dict[str, Any] = {"signed_tx": signed_tx, "chain_id": chain_id}
        if venue_id is not None:
            params["venue_id"] = venue_id
        if mev_protection:
            params["mev_protection"] = True
        return self._call_tool_model("dex_broadcast", BroadcastResult, params)

    def tx_status(
        self,
        tx_hash: str,
        chain_id: int,
        venue_id: str | None = None,
    ) -> TransactionStatus:
        """Check on-chain status of a broadcast transaction."""
        params: dict[str, Any] = {"tx_hash": tx_hash, "chain_id": chain_id}
        if venue_id is not None:
            params["venue_id"] = venue_id
        return self._call_tool_model("dex_tx_status", TransactionStatus, params)

    # -- Market data (currently 1inch-powered, but agent-facing API is venue-agnostic) --

    def balances(self, chain_id: int, wallet: str) -> Balances:
        """Get all token balances for a wallet on a chain."""
        return self._call_tool_model("oneinch_balances", Balances, {"chain_id": chain_id, "wallet": wallet})

    def allowances(self, chain_id: int, wallet: str, spender: str) -> Any:
        """Check token allowances for a spender (EVM only)."""
        return self._call_tool("oneinch_allowances", {"chain_id": chain_id, "wallet": wallet, "spender": spender})

    def spot_price(self, chain_id: int, tokens: str) -> SpotPrice:
        """Get USD spot prices for tokens (comma-separated addresses)."""
        return self._call_tool_model("oneinch_spot_price", SpotPrice, {"chain_id": chain_id, "tokens": tokens})

    def gas_price(self, chain_id: int) -> GasPrice:
        """Get current gas prices (low/medium/high)."""
        return self._call_tool_model("oneinch_gas_price", GasPrice, {"chain_id": chain_id})

    def token_search(self, chain_id: int, query: str) -> list[TokenSearchResult]:
        """Search tokens by name or symbol."""
        data = self._call_tool("oneinch_token_search", {"chain_id": chain_id, "query": query})
        return [TokenSearchResult.model_validate(t) for t in data.get("tokens", [])]

    def token_info(self, chain_id: int, address: str) -> TokenInfo:
        """Get detailed token info by contract address."""
        return self._call_tool_model("oneinch_token_info", TokenInfo, {"chain_id": chain_id, "address": address})

    def chart(self, chain_id: int, token0: str, token1: str, period: str = "1h") -> list[ChartCandle]:
        """Get OHLCV chart data for a token pair."""
        data = self._call_tool("oneinch_chart", {
            "chain_id": chain_id, "token0": token0, "token1": token1, "period": period,
        })
        return [ChartCandle.model_validate(c) for c in data.get("candles", [])]
```

- [ ] **Step 4: Update _services/__init__.py**

```python
# src/mangrovemarkets/_services/__init__.py
from .dex import DexService
from .wallet import WalletService

__all__ = ["DexService", "WalletService"]
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_dex.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add packages/python-sdk/src/mangrovemarkets/_services/dex.py packages/python-sdk/src/mangrovemarkets/_services/__init__.py packages/python-sdk/tests/test_dex.py
git commit -m "feat(python-sdk): DexService with swap flow + market data, 14 methods"
```

---

## Task 7: PortfolioService

**Files:**
- Create: `packages/python-sdk/src/mangrovemarkets/_services/portfolio.py`
- Create: `packages/python-sdk/tests/test_portfolio.py`

- [ ] **Step 1: Write portfolio tests**

```python
# tests/test_portfolio.py
from __future__ import annotations

from mangrovemarkets._transport._auth import NoAuth
from mangrovemarkets._transport._mock import MockTransport
from mangrovemarkets._transport._service import ServiceTransport
from mangrovemarkets.models.portfolio import PortfolioDefi, PortfolioPnL, PortfolioTokens, PortfolioValue, TxHistoryEntry


def _make_service() -> tuple[MockTransport, "PortfolioService"]:
    from mangrovemarkets._services.portfolio import PortfolioService
    mock = MockTransport()
    transport = ServiceTransport(mock, "http://test/api/v1", NoAuth())
    return mock, PortfolioService(transport)


class TestPortfolioValue:
    def test_returns_value(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/oneinch_portfolio_value", json={
            "total_value_usd": 12345.67,
            "chains": {"8453": {"value_usd": 12345.67}},
        })
        result = svc.value(addresses="0xbf5...")
        assert isinstance(result, PortfolioValue)
        assert result.total_value_usd == 12345.67


class TestPortfolioPnL:
    def test_returns_pnl(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/oneinch_portfolio_pnl", json={
            "total_pnl_usd": 500.0,
        })
        result = svc.pnl(addresses="0xbf5...")
        assert isinstance(result, PortfolioPnL)
        assert result.total_pnl_usd == 500.0


class TestPortfolioTokens:
    def test_returns_tokens(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/oneinch_portfolio_tokens", json={
            "tokens": [{"symbol": "ETH", "balance": "1.5", "value_usd": 3000.0}],
        })
        result = svc.tokens(addresses="0xbf5...")
        assert isinstance(result, PortfolioTokens)
        assert len(result.tokens) == 1


class TestPortfolioDefi:
    def test_returns_defi(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/oneinch_portfolio_defi", json={
            "positions": [{"protocol": "Aave", "value_usd": 5000.0}],
        })
        result = svc.defi(addresses="0xbf5...")
        assert isinstance(result, PortfolioDefi)
        assert len(result.positions) == 1


class TestHistory:
    def test_returns_history(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/oneinch_history", json={
            "transactions": [
                {"tx_hash": "0xabc...", "chain_id": 8453, "status": "confirmed"},
            ]
        })
        result = svc.history(address="0xbf5...")
        assert len(result) == 1
        assert isinstance(result[0], TxHistoryEntry)
        assert result[0].tx_hash == "0xabc..."
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_portfolio.py -v
```

Expected: FAIL

- [ ] **Step 3: Create portfolio.py service**

```python
# src/mangrovemarkets/_services/portfolio.py
from __future__ import annotations

from ..models.portfolio import PortfolioDefi, PortfolioPnL, PortfolioTokens, PortfolioValue, TxHistoryEntry
from ._base import BaseService


class PortfolioService(BaseService):
    """Cross-chain portfolio analytics. Currently 1inch-powered but venue-agnostic API."""

    def value(self, addresses: str, chain_id: int | None = None) -> PortfolioValue:
        """Total portfolio value across chains."""
        params: dict = {"addresses": addresses}
        if chain_id is not None:
            params["chain_id"] = chain_id
        return self._call_tool_model("oneinch_portfolio_value", PortfolioValue, params)

    def pnl(self, addresses: str, chain_id: int | None = None) -> PortfolioPnL:
        """Portfolio profit and loss."""
        params: dict = {"addresses": addresses}
        if chain_id is not None:
            params["chain_id"] = chain_id
        return self._call_tool_model("oneinch_portfolio_pnl", PortfolioPnL, params)

    def tokens(self, addresses: str, chain_id: int | None = None) -> PortfolioTokens:
        """ERC-20 token holdings detail."""
        params: dict = {"addresses": addresses}
        if chain_id is not None:
            params["chain_id"] = chain_id
        return self._call_tool_model("oneinch_portfolio_tokens", PortfolioTokens, params)

    def defi(self, addresses: str, chain_id: int | None = None) -> PortfolioDefi:
        """DeFi protocol positions."""
        params: dict = {"addresses": addresses}
        if chain_id is not None:
            params["chain_id"] = chain_id
        return self._call_tool_model("oneinch_portfolio_defi", PortfolioDefi, params)

    def history(self, address: str, limit: int = 50) -> list[TxHistoryEntry]:
        """Wallet transaction history."""
        data = self._call_tool("oneinch_history", {"address": address, "limit": limit})
        return [TxHistoryEntry.model_validate(tx) for tx in data.get("transactions", [])]
```

- [ ] **Step 4: Update _services/__init__.py**

```python
# src/mangrovemarkets/_services/__init__.py
from .dex import DexService
from .portfolio import PortfolioService
from .wallet import WalletService

__all__ = ["DexService", "PortfolioService", "WalletService"]
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_portfolio.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add packages/python-sdk/src/mangrovemarkets/_services/portfolio.py packages/python-sdk/src/mangrovemarkets/_services/__init__.py packages/python-sdk/tests/test_portfolio.py
git commit -m "feat(python-sdk): PortfolioService with 5 analytics methods"
```

---

## Task 8: MangroveMarkets client class

**Files:**
- Create: `packages/python-sdk/src/mangrovemarkets/_client.py`
- Modify: `packages/python-sdk/src/mangrovemarkets/__init__.py`
- Create: `packages/python-sdk/tests/test_client.py`

- [ ] **Step 1: Write client tests**

```python
# tests/test_client.py
from __future__ import annotations

from mangrovemarkets import MangroveMarkets
from mangrovemarkets._services.dex import DexService
from mangrovemarkets._services.portfolio import PortfolioService
from mangrovemarkets._services.wallet import WalletService
from mangrovemarkets._transport._mock import MockTransport


def _make_client(mock: MockTransport | None = None) -> MangroveMarkets:
    m = mock or MockTransport()
    return MangroveMarkets(base_url="http://test", httpx_client=m)


class TestClientConstruction:
    def test_default_construction(self) -> None:
        client = _make_client()
        assert client is not None

    def test_with_api_key(self) -> None:
        mock = MockTransport()
        mock.add_response("POST", "/tools/dex_supported_venues", json={"venues": []})
        client = MangroveMarkets(base_url="http://test", api_key="my-key", httpx_client=mock)
        client.dex.supported_venues()
        assert mock.requests[0].headers["Authorization"] == "Bearer my-key"

    def test_context_manager(self) -> None:
        mock = MockTransport()
        with MangroveMarkets(base_url="http://test", httpx_client=mock) as client:
            assert client is not None


class TestServiceAccess:
    def test_wallet_service(self) -> None:
        client = _make_client()
        assert isinstance(client.wallet, WalletService)

    def test_dex_service(self) -> None:
        client = _make_client()
        assert isinstance(client.dex, DexService)

    def test_portfolio_service(self) -> None:
        client = _make_client()
        assert isinstance(client.portfolio, PortfolioService)

    def test_services_are_cached(self) -> None:
        client = _make_client()
        assert client.wallet is client.wallet
        assert client.dex is client.dex
        assert client.portfolio is client.portfolio
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_client.py -v
```

Expected: FAIL

- [ ] **Step 3: Create _client.py**

```python
# src/mangrovemarkets/_client.py
from __future__ import annotations

from functools import cached_property
from typing import Any

import httpx

from ._config import ClientConfig
from ._services.dex import DexService
from ._services.portfolio import PortfolioService
from ._services.wallet import WalletService
from ._transport._auth import ApiKeyAuth, NoAuth
from ._transport._http import HttpTransport
from ._transport._mock import MockTransport
from ._transport._retry import RetryConfig
from ._transport._service import ServiceTransport


class MangroveMarkets:
    """MangroveMarkets Python SDK client.

    Args:
        base_url: MCP server base URL. Falls back to MANGROVE_BASE_URL env var, then localhost:8080.
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

        auth = ApiKeyAuth(self._config.api_key) if self._config.api_key else NoAuth()
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

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> MangroveMarkets:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
```

- [ ] **Step 4: Update __init__.py with full public API**

```python
# src/mangrovemarkets/__init__.py
"""MangroveMarkets Python SDK.

Quickstart:
    from mangrovemarkets import MangroveMarkets

    client = MangroveMarkets(base_url="http://localhost:8080")
    venues = client.dex.supported_venues()
"""

from ._client import MangroveMarkets
from ._version import __version__
from .exceptions import (
    APIError,
    AuthenticationError,
    ConfigurationError,
    ConnectionError,
    MangroveError,
    NotFoundError,
    NotImplementedOnServer,
    RateLimitError,
    ServerError,
    TimeoutError,
    ValidationError,
)

__all__ = [
    "__version__",
    "MangroveMarkets",
    "MangroveError",
    "APIError",
    "AuthenticationError",
    "ConfigurationError",
    "ConnectionError",
    "NotFoundError",
    "NotImplementedOnServer",
    "RateLimitError",
    "ServerError",
    "TimeoutError",
    "ValidationError",
]
```

- [ ] **Step 5: Run all tests**

```bash
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add packages/python-sdk/src/mangrovemarkets/_client.py packages/python-sdk/src/mangrovemarkets/__init__.py packages/python-sdk/tests/test_client.py
git commit -m "feat(python-sdk): MangroveMarkets client with wallet, dex, portfolio services"
```

---

## Task 9: README, examples, py.typed

**Files:**
- Create: `packages/python-sdk/src/mangrovemarkets/py.typed`
- Create: `packages/python-sdk/README.md`
- Create: `packages/python-sdk/examples/quickstart.py`
- Create: `packages/python-sdk/examples/swap_flow.py`
- Create: `packages/python-sdk/examples/portfolio_check.py`

- [ ] **Step 1: Create py.typed marker**

```bash
touch packages/python-sdk/src/mangrovemarkets/py.typed
```

- [ ] **Step 2: Create README.md**

Write a README with: badges, install (`pip install mangrovemarkets`), quickstart showing wallet + dex + portfolio, link to examples/, link to MangroveMarkets-MCP-Server docs. Keep under 150 lines.

- [ ] **Step 3: Create examples/quickstart.py**

```python
# examples/quickstart.py
"""Quick start: check chain info and list DEX venues."""
from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(base_url="http://localhost:8080")

# Chain info
info = client.wallet.chain_info(chain="evm")
print(f"Chain: {info.chain}, Native token: {info.native_token}")

# DEX venues
venues = client.dex.supported_venues()
for v in venues:
    print(f"  {v.id}: {v.name} ({v.chain}) — {v.supported_pairs_count} pairs")

client.close()
```

- [ ] **Step 4: Create examples/swap_flow.py**

```python
# examples/swap_flow.py
"""Full DEX swap flow: quote -> approve -> prepare -> sign -> broadcast -> confirm."""
from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(base_url="http://localhost:8080")

# 1. Get quote
quote = client.dex.get_quote(
    input_token="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # USDC on Base
    output_token="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",  # ETH
    amount=1_000_000,  # 1 USDC (6 decimals)
    chain_id=8453,
)
print(f"Quote: {quote.input_amount} -> {quote.output_amount} (rate: {quote.exchange_rate})")

# 2. Approve token (ERC-20 only, skip for native tokens)
approval = client.dex.approve_token(
    token_address="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chain_id=8453,
    wallet_address="YOUR_WALLET_ADDRESS",
)
if approval:
    print(f"Sign this approval tx locally: {approval.payload}")
    # signed_approval = your_signer.sign(approval.payload)
    # client.dex.broadcast(signed_tx=signed_approval, chain_id=8453)

# 3. Prepare swap
swap_tx = client.dex.prepare_swap(quote_id=quote.quote_id, wallet_address="YOUR_WALLET_ADDRESS")
print(f"Sign this swap tx locally: {swap_tx.payload}")

# 4. Sign locally (agent does this with web3.py / xrpl-py)
# signed_swap = your_signer.sign(swap_tx.payload)

# 5. Broadcast
# result = client.dex.broadcast(signed_tx=signed_swap, chain_id=8453)
# print(f"Broadcast: {result.tx_hash}")

# 6. Check status
# status = client.dex.tx_status(tx_hash=result.tx_hash, chain_id=8453)
# print(f"Status: {status.status}")

client.close()
```

- [ ] **Step 5: Create examples/portfolio_check.py**

```python
# examples/portfolio_check.py
"""Check portfolio value and token holdings."""
from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(base_url="http://localhost:8080")

wallet = "0xYOUR_WALLET_ADDRESS"

# Portfolio overview
value = client.portfolio.value(addresses=wallet)
print(f"Total portfolio: ${value.total_value_usd:,.2f}")

# P&L
pnl = client.portfolio.pnl(addresses=wallet)
print(f"Total P&L: ${pnl.total_pnl_usd:,.2f}")

# Token holdings
holdings = client.portfolio.tokens(addresses=wallet)
for token in holdings.tokens or []:
    print(f"  {token.get('symbol', '???')}: {token.get('balance', 0)} (${token.get('value_usd', 0):,.2f})")

# Recent transactions
history = client.portfolio.history(address=wallet, limit=5)
for tx in history:
    print(f"  {tx.tx_hash[:10]}... — {tx.status}")

client.close()
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/darrahts/mangrove-workspace/MangroveMarkets/packages/python-sdk
pip install build
python -m build
twine check dist/*
```

Expected: `PASSED`

- [ ] **Step 7: Commit**

```bash
git add packages/python-sdk/src/mangrovemarkets/py.typed packages/python-sdk/README.md packages/python-sdk/examples/
git commit -m "feat(python-sdk): README, examples, py.typed marker"
```

---

## Task 10: CI/CD workflows

**Files:**
- Create: `packages/python-sdk/.github/workflows/python-sdk-ci.yml` (note: actually goes at repo root `.github/workflows/`)
- Create: `packages/python-sdk/.github/workflows/python-sdk-release.yml` (same, repo root)

- [ ] **Step 1: Create CI workflow**

Path: `.github/workflows/python-sdk-ci.yml` (at MangroveMarkets repo root)

```yaml
name: Python SDK CI

on:
  pull_request:
    paths:
      - "packages/python-sdk/**"
  push:
    branches: [main]
    paths:
      - "packages/python-sdk/**"

defaults:
  run:
    working-directory: packages/python-sdk

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - run: pip install -e ".[dev]"
      - run: ruff check src/ tests/
      - run: mypy src/mangrovemarkets/
      - run: pytest tests/ -v --cov=mangrovemarkets --cov-report=term-missing
```

- [ ] **Step 2: Create release workflow**

Path: `.github/workflows/python-sdk-release.yml` (at MangroveMarkets repo root)

```yaml
name: Python SDK Release

on:
  workflow_dispatch:
    inputs:
      bump:
        description: "Version bump type"
        required: true
        type: choice
        options:
          - patch
          - minor
          - major
        default: patch

defaults:
  run:
    working-directory: packages/python-sdk

permissions:
  contents: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          fetch-tags: true

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install -e ".[dev]"

      - name: Run tests
        run: pytest tests/ -v

      - name: Compute next version
        id: version
        env:
          BUMP_TYPE: ${{ github.event.inputs.bump }}
        run: |
          LATEST_TAG=$(git tag -l 'python-sdk-v*' --sort=-v:refname | head -1)
          if [ -z "$LATEST_TAG" ]; then
            LATEST_TAG="python-sdk-v0.0.0"
          fi
          CURRENT="${LATEST_TAG#python-sdk-v}"
          IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
          case "$BUMP_TYPE" in
            major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
            minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
            patch) PATCH=$((PATCH + 1)) ;;
          esac
          NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
          echo "version=${NEW_VERSION}" >> "$GITHUB_OUTPUT"
          echo "tag=python-sdk-v${NEW_VERSION}" >> "$GITHUB_OUTPUT"
          echo "Releasing: ${LATEST_TAG} -> python-sdk-v${NEW_VERSION}"

      - name: Update version files
        env:
          NEW_VERSION: ${{ steps.version.outputs.version }}
        run: |
          sed -i "s/^version = .*/version = \"${NEW_VERSION}\"/" pyproject.toml
          sed -i "s/^__version__ = .*/__version__ = \"${NEW_VERSION}\"/" src/mangrovemarkets/_version.py

      - name: Commit and tag
        env:
          VERSION_TAG: ${{ steps.version.outputs.tag }}
          NEW_VERSION: ${{ steps.version.outputs.version }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add pyproject.toml src/mangrovemarkets/_version.py
          git diff --cached --quiet || git commit -m "release: python-sdk v${NEW_VERSION}"
          git tag -a "$VERSION_TAG" -m "Release $VERSION_TAG"
          git push origin HEAD:main --follow-tags

      - name: Build
        run: |
          pip install build
          python -m build

      - name: Verify version
        env:
          EXPECTED: ${{ steps.version.outputs.version }}
        run: |
          BUILT=$(unzip -p dist/*.whl '*/METADATA' | grep '^Version:' | cut -d' ' -f2)
          echo "Expected: ${EXPECTED}, Built: ${BUILT}"
          [ "$BUILT" = "$EXPECTED" ] || exit 1

      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@release/v1
        with:
          password: ${{ secrets.PYPI_API_TOKEN }}
          packages-dir: packages/python-sdk/dist/

      - name: GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.version.outputs.tag }}
          name: mangrovemarkets ${{ steps.version.outputs.version }}
          generate_release_notes: true
          body: |
            ## mangrovemarkets ${{ steps.version.outputs.version }}

            ```bash
            pip install mangrovemarkets==${{ steps.version.outputs.version }}
            ```
```

Note: tags are prefixed `python-sdk-v*` to avoid collision with TS SDK tags in the same monorepo.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/python-sdk-ci.yml .github/workflows/python-sdk-release.yml
git commit -m "ci(python-sdk): add CI + release workflows for PyPI publishing"
```

---

## Task 11: Final integration test + PR

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/darrahts/mangrove-workspace/MangroveMarkets/packages/python-sdk
pytest tests/ -v --tb=short
```

Expected: all PASS

- [ ] **Step 2: Run linter**

```bash
ruff check src/ tests/
```

Expected: no errors

- [ ] **Step 3: Run type checker**

```bash
mypy src/mangrovemarkets/
```

Expected: no errors (or only expected strict-mode warnings)

- [ ] **Step 4: Verify package builds**

```bash
pip install build && python -m build
```

Expected: `dist/mangrovemarkets-0.1.0.tar.gz` and `dist/mangrovemarkets-0.1.0-py3-none-any.whl`

- [ ] **Step 5: Push branch and create PR**

```bash
git push -u origin feature/python-sdk-pypi-v0.1
gh pr create --title "feat: mangrovemarkets Python SDK v0.1.0" --body "$(cat <<'EOF'
## Summary
- Publishes `mangrovemarkets` to PyPI — typed Python SDK for MangroveMarkets MCP server
- 3 services: wallet (2 methods), dex (14 methods), portfolio (5 methods)
- Mirrors MangroveAI-SDK architecture (hatchling, httpx, Pydantic v2, MockTransport)
- Transport protocol ABC ready for future MCP transport
- Full test suite with MockTransport (no live server needed)
- CI workflow (test on PR) + release workflow (publish to PyPI on dispatch)

## Test plan
- [ ] `pytest tests/ -v` passes locally
- [ ] `ruff check` and `mypy` pass
- [ ] Package builds cleanly (`python -m build`)
- [ ] README renders on PyPI (verify after first publish)
- [ ] Add PYPI_API_TOKEN to repo secrets before first release dispatch

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Wait for human approval before merging**
