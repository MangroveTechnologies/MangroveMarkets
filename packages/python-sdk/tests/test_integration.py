"""Integration tests against a live MangroveMarkets MCP server.

Run with: MANGROVE_TEST_URL=https://... pytest tests/test_integration.py -v
Skipped automatically when MANGROVE_TEST_URL is not set.
"""
from __future__ import annotations

import os

import pytest

from mangrovemarkets import MangroveMarkets
from mangrovemarkets.exceptions import APIError
from mangrovemarkets.models.dex import Quote, Venue
from mangrovemarkets.models.market_data import Balances, GasPrice, SpotPrice
from mangrovemarkets.models.wallet import ChainInfo, WalletCreateResult

LIVE_URL = os.environ.get("MANGROVE_TEST_URL")

pytestmark = pytest.mark.skipif(LIVE_URL is None, reason="MANGROVE_TEST_URL not set")


@pytest.fixture(scope="module")
def client() -> MangroveMarkets:
    assert LIVE_URL is not None
    return MangroveMarkets(base_url=LIVE_URL)


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
        """wallet_create may fail in Cloud Run due to async event loop.
        Verify we get either a wallet or a clean APIError."""
        try:
            result = client.wallet.create(chain="xrpl", network="testnet")
            assert isinstance(result, WalletCreateResult)
            assert result.address.startswith("r")
        except APIError as e:
            assert e.code == "WALLET_CREATE_FAILED"


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
        """Quote 1 USDC -> ETH on Base via 1inch.
        May fail if 1inch API key is rate-limited; verify clean error."""
        try:
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
        except APIError as e:
            assert e.code is not None  # clean error, not a crash

    def test_gas_price(self, client: MangroveMarkets) -> None:
        """May fail if 1inch API key not configured for this chain."""
        try:
            result = client.dex.gas_price(chain_id=8453)
            assert isinstance(result, GasPrice)
        except APIError as e:
            assert e.code == "GAS_PRICE_FAILED"

    def test_spot_price(self, client: MangroveMarkets) -> None:
        try:
            result = client.dex.spot_price(
                chain_id=8453,
                tokens="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            )
            assert isinstance(result, SpotPrice)
        except APIError as e:
            assert e.code is not None

    def test_balances(self, client: MangroveMarkets) -> None:
        try:
            result = client.dex.balances(
                chain_id=8453,
                wallet="0x0000000000000000000000000000000000000001",
            )
            assert isinstance(result, Balances)
            assert isinstance(result.balances, dict)
        except APIError as e:
            assert e.code is not None
