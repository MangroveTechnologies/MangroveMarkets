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
        client = MangroveMarkets(
            base_url="http://test", api_key="my-key", httpx_client=mock
        )
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
