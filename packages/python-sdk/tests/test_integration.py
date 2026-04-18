"""Integration tests against a live MangroveMarkets MCP server.

Run with:
    MANGROVE_TEST_URL=https://... \\
    MANGROVE_TEST_API_KEY=... \\
    pytest tests/test_integration.py -v

Skipped automatically when MANGROVE_TEST_URL or MANGROVE_TEST_API_KEY is not set.
"""
from __future__ import annotations

import os

import pytest

from mangrovemarkets import MangroveMarkets
from mangrovemarkets.models.dex import Quote, Venue
from mangrovemarkets.models.market_data import Balances, GasPrice, SpotPrice
from mangrovemarkets.models.wallet import ChainInfo, WalletCreateResult

LIVE_URL = os.environ.get("MANGROVE_TEST_URL")
API_KEY = os.environ.get("MANGROVE_TEST_API_KEY") or os.environ.get("MANGROVE_API_KEY")

pytestmark = pytest.mark.skipif(
    LIVE_URL is None or API_KEY is None,
    reason="MANGROVE_TEST_URL and MANGROVE_TEST_API_KEY required for integration tests",
)


@pytest.fixture(scope="module")
def client() -> MangroveMarkets:
    assert LIVE_URL is not None
    assert API_KEY is not None
    return MangroveMarkets(base_url=LIVE_URL, api_key=API_KEY)


class TestWalletIntegration:
    def test_chain_info_xrpl(self, client: MangroveMarkets) -> None:
        result = client.wallet.chain_info(chain="xrpl")
        assert isinstance(result, ChainInfo)
        assert result.chain == "xrpl"
        assert result.native_token == "XRP"

    def test_chain_info_evm(self, client: MangroveMarkets) -> None:
        result = client.wallet.chain_info(chain="evm")
        assert isinstance(result, ChainInfo)
        assert result.chain == "evm"
        assert result.native_token == "ETH"

    def test_create_xrpl_wallet(self, client: MangroveMarkets) -> None:
        result = client.wallet.create(chain="xrpl", network="testnet")
        assert isinstance(result, WalletCreateResult)
        assert result.address.startswith("r")
        assert result.is_funded is True


class TestDexIntegration:
    def test_supported_venues(self, client: MangroveMarkets) -> None:
        result = client.dex.supported_venues()
        assert isinstance(result, list)
        assert len(result) > 0
        assert all(isinstance(v, Venue) for v in result)
        venue_ids = [v.id for v in result]
        assert "1inch" in venue_ids

    def test_supported_pairs(self, client: MangroveMarkets) -> None:
        result = client.dex.supported_pairs(venue_id="1inch")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_get_quote_1inch(self, client: MangroveMarkets) -> None:
        """Quote 1 USDC -> ETH on Base via 1inch."""
        result = client.dex.get_quote(
            input_token="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            output_token="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            amount=1_000_000,
            venue_id="1inch",
            chain_id=8453,
        )
        assert isinstance(result, Quote)
        assert result.quote_id is not None
        assert result.output_amount > 0

    def test_gas_price(self, client: MangroveMarkets) -> None:
        result = client.dex.gas_price(chain_id=8453)
        assert isinstance(result, GasPrice)
        # Base (EIP-1559 chain) returns nested gas structure
        assert result.gas is not None
        assert "baseFee" in result.gas
        assert "medium" in result.gas

    def test_spot_price(self, client: MangroveMarkets) -> None:
        result = client.dex.spot_price(
            chain_id=8453,
            tokens="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        )
        assert isinstance(result, SpotPrice)

    def test_balances(self, client: MangroveMarkets) -> None:
        result = client.dex.balances(
            chain_id=8453,
            wallet="0x0000000000000000000000000000000000000001",
        )
        assert isinstance(result, Balances)
        assert isinstance(result.balances, dict)
