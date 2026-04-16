from __future__ import annotations

import pytest

from mangrovemarkets._transport._auth import NoAuth
from mangrovemarkets._transport._mock import MockTransport
from mangrovemarkets._transport._service import ServiceTransport
from mangrovemarkets._services.wallet import WalletService
from mangrovemarkets.models.wallet import ChainInfo, WalletCreateResult
from mangrovemarkets.exceptions import NotImplementedOnServer


def _make_service() -> tuple[MockTransport, WalletService]:
    mock = MockTransport()
    transport = ServiceTransport(mock, "http://test/api/v1", NoAuth())
    return mock, WalletService(transport)


class TestChainInfo:
    def test_returns_chain_info(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/wallet_chain_info",
            json={
                "chain": "evm",
                "chain_family": "evm",
                "native_token": "ETH",
                "wallet_creation": "client_side_only",
                "supported_chain_ids": [1, 8453],
            },
        )
        result = svc.chain_info(chain="evm")
        assert isinstance(result, ChainInfo)
        assert result.chain == "evm"
        assert result.native_token == "ETH"
        assert mock.requests[0].json == {"chain": "evm"}


class TestWalletCreate:
    def test_create_xrpl_wallet(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/wallet_create",
            json={
                "address": "r4Vx2CdzRwHQHqGCUgDjTqa8PoFRdJjPuJ",
                "secret": "sEdV...",
                "network": "testnet",
                "chain": "xrpl",
                "is_funded": True,
                "warnings": ["IMPORTANT: Save your wallet secret now"],
            },
        )
        result = svc.create(chain="xrpl", network="testnet")
        assert isinstance(result, WalletCreateResult)
        assert result.address.startswith("r")
        assert result.is_funded is True
        assert mock.requests[0].json == {"chain": "xrpl", "network": "testnet"}

    def test_create_evm_wallet(self) -> None:
        mock, svc = _make_service()
        mock.add_response(
            "POST",
            "/tools/wallet_create",
            json={
                "address": "0xbf57B1ACf74885e215617783Fad4aE4DF849A8d0",
                "private_key": "0x4f9010df...",
                "chain": "evm",
                "chain_id": 8453,
                "network": "evm",
                "is_funded": False,
            },
        )
        result = svc.create(chain="evm", chain_id=8453)
        assert result.address.startswith("0x")
        assert result.private_key is not None
        assert result.chain_id == 8453


class TestNotImplementedStubs:
    def test_balance_raises(self) -> None:
        _, svc = _make_service()
        with pytest.raises(NotImplementedOnServer, match="wallet_balance"):
            svc.balance(address="r4Vx...")

    def test_transactions_raises(self) -> None:
        _, svc = _make_service()
        with pytest.raises(NotImplementedOnServer, match="wallet_transactions"):
            svc.transactions(address="r4Vx...")
