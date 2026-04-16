from __future__ import annotations

import pytest

from mangrovemarkets._transport._auth import ApiKeyAuth, NoAuth
from mangrovemarkets._transport._mock import MockTransport
from mangrovemarkets._transport._retry import RetryConfig
from mangrovemarkets._transport._service import ServiceTransport


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
