from __future__ import annotations

from mangrovemarkets._transport._auth import NoAuth
from mangrovemarkets._transport._mock import MockTransport
from mangrovemarkets._transport._service import ServiceTransport
from mangrovemarkets._services.dex import DexService
from mangrovemarkets.models.dex import (
    BroadcastResult,
    Quote,
    TransactionStatus,
    UnsignedTransaction,
    Venue,
)
from mangrovemarkets.models.market_data import (
    Balances,
    GasPrice,
    SpotPrice,
    TokenSearchResult,
)


def _make_service() -> tuple[MockTransport, DexService]:
    mock = MockTransport()
    transport = ServiceTransport(mock, "http://test/api/v1", NoAuth())
    return mock, DexService(transport)


class TestSupportedVenues:
    def test_returns_venue_list(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/dex_supported_venues",
            json={
                "venues": [
                    {
                        "id": "1inch",
                        "name": "1inch Aggregator",
                        "chain": "multi",
                        "status": "active",
                        "supported_pairs_count": 3,
                        "fee_percent": 0.0025,
                    },
                    {
                        "id": "xpmarket",
                        "name": "XPMarket",
                        "chain": "xrpl-testnet",
                        "status": "active",
                        "supported_pairs_count": 2,
                        "fee_percent": 0.001,
                    },
                ]
            },
        )
        result = svc.supported_venues()
        assert len(result) == 2
        assert isinstance(result[0], Venue)
        assert result[0].id == "1inch"


class TestGetQuote:
    def test_returns_quote(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/dex_get_quote",
            json={
                "quote_id": "1inch-a1b2c3",
                "venue_id": "1inch",
                "input_token": "0x833...",
                "output_token": "0xEee...",
                "input_amount": 1000000,
                "output_amount": 459244868977722,
                "exchange_rate": 4.59e-7,
                "chain_id": 8453,
            },
        )
        result = svc.get_quote(
            input_token="0x833...",
            output_token="0xEee...",
            amount=1000000,
            chain_id=8453,
        )
        assert isinstance(result, Quote)
        assert result.quote_id == "1inch-a1b2c3"
        assert result.chain_id == 8453


class TestPrepareSwap:
    def test_returns_unsigned_tx(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/dex_prepare_swap",
            json={
                "chain_family": "evm",
                "chain_id": 8453,
                "venue_id": "1inch",
                "description": "Swap USDC for ETH",
                "payload": {
                    "to": "0x111...",
                    "data": "0x12aa...",
                    "value": "0",
                    "gas": 234948,
                },
                "estimated_gas": "234948",
            },
        )
        result = svc.prepare_swap(
            quote_id="1inch-a1b2c3", wallet_address="0xbf5..."
        )
        assert isinstance(result, UnsignedTransaction)
        assert result.chain_family == "evm"
        assert "to" in result.payload


class TestBroadcast:
    def test_returns_broadcast_result(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/dex_broadcast",
            json={
                "tx_hash": "0xc29ac8f7...",
                "chain_family": "evm",
                "chain_id": 8453,
                "venue_id": "1inch",
                "broadcast_method": "public",
            },
        )
        result = svc.broadcast(signed_tx="0xabc...", chain_id=8453)
        assert isinstance(result, BroadcastResult)
        assert result.tx_hash == "0xc29ac8f7..."


class TestTxStatus:
    def test_returns_status(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/dex_tx_status",
            json={
                "tx_hash": "0xc29ac8f7...",
                "chain_family": "evm",
                "chain_id": 8453,
                "status": "confirmed",
                "block_number": 12345678,
                "gas_used": "150000",
            },
        )
        result = svc.tx_status(tx_hash="0xc29ac8f7...", chain_id=8453)
        assert isinstance(result, TransactionStatus)
        assert result.status == "confirmed"


class TestBalances:
    def test_returns_balances(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_balances",
            json={
                "chain_id": 8453,
                "wallet": "0xbf5...",
                "balances": {
                    "0xeeee...": "5470648682909640",
                    "0x8335...": "9000000",
                },
            },
        )
        result = svc.balances(chain_id=8453, wallet="0xbf5...")
        assert isinstance(result, Balances)
        assert len(result.balances) == 2


class TestSpotPrice:
    def test_returns_prices(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_spot_price",
            json={"chain_id": 8453, "prices": {"0x833...": "1.0001"}},
        )
        result = svc.spot_price(chain_id=8453, tokens="0x833...")
        assert isinstance(result, SpotPrice)


class TestGasPrice:
    def test_returns_gas(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_gas_price",
            json={
                "chain_id": 8453,
                "low": "100000",
                "medium": "150000",
                "high": "200000",
            },
        )
        result = svc.gas_price(chain_id=8453)
        assert isinstance(result, GasPrice)
        assert result.medium == "150000"


class TestTokenSearch:
    def test_returns_tokens(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/oneinch_token_search",
            json={
                "tokens": [
                    {
                        "address": "0x833...",
                        "symbol": "USDC",
                        "name": "USD Coin",
                        "decimals": 6,
                    }
                ]
            },
        )
        result = svc.token_search(chain_id=8453, query="USDC")
        assert len(result) == 1
        assert isinstance(result[0], TokenSearchResult)
        assert result[0].symbol == "USDC"
