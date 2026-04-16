from __future__ import annotations

from mangrovemarkets._transport._auth import NoAuth
from mangrovemarkets._transport._mock import MockTransport
from mangrovemarkets._transport._service import ServiceTransport
from mangrovemarkets._services.portfolio import PortfolioService
from mangrovemarkets.models.portfolio import (
    PortfolioDefi,
    PortfolioPnL,
    PortfolioTokens,
    PortfolioValue,
    TxHistoryEntry,
)


def _make_service() -> tuple[MockTransport, PortfolioService]:
    mock = MockTransport()
    transport = ServiceTransport(mock, "http://test/api/v1", NoAuth())
    return mock, PortfolioService(transport)


class TestPortfolioValue:
    def test_returns_value(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_portfolio_value",
            json={
                "total_value_usd": 12345.67,
                "chains": {"8453": {"value_usd": 12345.67}},
            },
        )
        result = svc.value(addresses="0xbf5...")
        assert isinstance(result, PortfolioValue)
        assert result.total_value_usd == 12345.67
        assert mock.requests[0].json == {"addresses": "0xbf5..."}

    def test_passes_chain_id(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_portfolio_value",
            json={"total_value_usd": 100.0},
        )
        svc.value(addresses="0xbf5...", chain_id=8453)
        assert mock.requests[0].json == {"addresses": "0xbf5...", "chain_id": 8453}


class TestPortfolioPnL:
    def test_returns_pnl(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_portfolio_pnl",
            json={"total_pnl_usd": 500.0},
        )
        result = svc.pnl(addresses="0xbf5...")
        assert isinstance(result, PortfolioPnL)
        assert result.total_pnl_usd == 500.0


class TestPortfolioTokens:
    def test_returns_tokens(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_portfolio_tokens",
            json={
                "tokens": [
                    {"symbol": "ETH", "balance": "1.5", "value_usd": 3000.0}
                ]
            },
        )
        result = svc.tokens(addresses="0xbf5...")
        assert isinstance(result, PortfolioTokens)
        assert len(result.tokens) == 1


class TestPortfolioDefi:
    def test_returns_defi(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_portfolio_defi",
            json={"positions": [{"protocol": "Aave", "value_usd": 5000.0}]},
        )
        result = svc.defi(addresses="0xbf5...")
        assert isinstance(result, PortfolioDefi)
        assert len(result.positions) == 1


class TestHistory:
    def test_returns_history(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_history",
            json={
                "transactions": [
                    {
                        "tx_hash": "0xabc...",
                        "chain_id": 8453,
                        "status": "confirmed",
                    }
                ]
            },
        )
        result = svc.history(address="0xbf5...")
        assert len(result) == 1
        assert isinstance(result[0], TxHistoryEntry)
        assert result[0].tx_hash == "0xabc..."
        assert mock.requests[0].json == {"address": "0xbf5...", "limit": 50}

    def test_empty_transactions(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_history",
            json={"transactions": []},
        )
        result = svc.history(address="0xbf5...")
        assert result == []
