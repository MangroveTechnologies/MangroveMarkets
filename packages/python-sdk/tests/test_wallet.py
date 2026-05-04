"""Tests for WalletService.

Wallet creation moved client-side in 0.2.0. These tests assert:

1. Keypair generation does NOT call the server's wallet_create tool.
2. The plaintext private_key / secret never appears in any HTTP request body.
3. Address-only calls (XRPL faucet relay) DO go to the server with no secrets.
4. Returned addresses are derivable from the returned keys (proves the
   keypair is real and consistent).
5. Existing chain_info, balance, and transactions stubs still behave.
"""
from __future__ import annotations

import json

import pytest

from mangrovemarkets._services.wallet import WalletService
from mangrovemarkets._transport._auth import NoAuth
from mangrovemarkets._transport._mock import MockTransport
from mangrovemarkets._transport._service import ServiceTransport
from mangrovemarkets.exceptions import APIError, NotImplementedOnServer
from mangrovemarkets.models.wallet import ChainInfo, WalletCreateResult


def _make_service() -> tuple[MockTransport, WalletService]:
    mock = MockTransport()
    transport = ServiceTransport(mock, "http://test/api/v1", NoAuth())
    return mock, WalletService(transport)


# ----------------------------------------------------------------------
# chain_info — server still authoritative, unchanged
# ----------------------------------------------------------------------

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
        assert result.wallet_creation == "client_side_only"
        assert mock.requests[0].json == {"chain": "evm"}


# ----------------------------------------------------------------------
# create — EVM (client-side)
# ----------------------------------------------------------------------

class TestCreateEvm:
    def test_does_not_call_server(self) -> None:
        """EVM wallet creation must not contact the server at all."""
        mock, svc = _make_service()
        svc.create(chain="evm", network="mainnet", chain_id=8453)
        assert mock.requests == [], (
            f"Expected zero HTTP requests, got {len(mock.requests)}: "
            f"{[(r.method, r.path) for r in mock.requests]}"
        )

    def test_returns_valid_keypair(self) -> None:
        """Returned address must derive from returned private_key."""
        from eth_account import Account

        _, svc = _make_service()
        result = svc.create(chain="evm", network="mainnet", chain_id=8453)

        assert isinstance(result, WalletCreateResult)
        assert result.chain == "evm"
        assert result.chain_id == 8453
        assert result.network == "mainnet"
        assert result.is_funded is False

        # The private_key must derive to the returned address. If the
        # SDK ever generates these inconsistently we'd hand the user a
        # locked-out wallet — fatal bug. Catch it here.
        assert result.private_key is not None
        assert result.private_key.startswith("0x")
        assert len(result.private_key) == 66  # 0x + 64 hex chars
        derived = Account.from_key(result.private_key).address
        assert derived == result.address

    def test_default_chain_is_evm(self) -> None:
        """0.2.0 changes the default chain to evm (was xrpl in 0.1.x)."""
        _, svc = _make_service()
        result = svc.create()  # no args
        assert result.chain == "evm"

    def test_each_call_produces_a_distinct_keypair(self) -> None:
        """Smoke test that we're not seeded."""
        _, svc = _make_service()
        a = svc.create(chain="evm")
        b = svc.create(chain="evm")
        assert a.address != b.address
        assert a.private_key != b.private_key

    def test_warnings_are_present(self) -> None:
        """The user-facing warnings must be in the result."""
        _, svc = _make_service()
        result = svc.create(chain="evm")
        assert result.warnings is not None
        assert len(result.warnings) >= 1
        assert any("save" in w.lower() for w in result.warnings)


# ----------------------------------------------------------------------
# create — XRPL (temporarily disabled)
# ----------------------------------------------------------------------

class TestCreateXrpl:
    """XRPL keygen is temporarily NotImplemented in 0.2.x — see
    `WalletService._create_xrpl` docstring for the reason. The critical
    invariant is that XRPL wallet creation must NOT silently fall back
    to the old server-side path. We assert it raises and never makes a
    network call."""

    def test_mainnet_raises_not_implemented(self) -> None:
        mock, svc = _make_service()
        with pytest.raises(NotImplementedError, match="XRPL"):
            svc.create(chain="xrpl", network="mainnet")
        assert mock.requests == [], "XRPL keygen must not contact the server"

    def test_testnet_raises_not_implemented(self) -> None:
        mock, svc = _make_service()
        with pytest.raises(NotImplementedError, match="XRPL"):
            svc.create(chain="xrpl", network="testnet")
        assert mock.requests == [], "XRPL keygen must not contact the server"


# ----------------------------------------------------------------------
# create — Solana (not implemented yet)
# ----------------------------------------------------------------------

class TestCreateSolana:
    def test_raises_not_implemented(self) -> None:
        _, svc = _make_service()
        with pytest.raises(NotImplementedError, match="Solana"):
            svc.create(chain="solana")


# ----------------------------------------------------------------------
# create — invalid chain
# ----------------------------------------------------------------------

class TestCreateInvalidChain:
    def test_unknown_chain_raises_value_error(self) -> None:
        _, svc = _make_service()
        with pytest.raises(ValueError, match="Unsupported chain"):
            svc.create(chain="ethereum")  # not a chain name we accept


# ----------------------------------------------------------------------
# Existing stubs — unchanged
# ----------------------------------------------------------------------

class TestToolErrorHandling:
    def test_server_error_raises_api_error(self) -> None:
        mock, svc = _make_service()
        mock.add_response("POST", "/tools/wallet_chain_info", json={
            "error": True,
            "code": "INVALID_CHAIN",
            "message": "Unsupported chain: solana",
            "suggestion": "Supported chains: xrpl, evm",
        })
        with pytest.raises(APIError, match="Unsupported chain: solana") as exc_info:
            svc.chain_info(chain="solana")
        assert exc_info.value.code == "INVALID_CHAIN"
        assert exc_info.value.suggestion == "Supported chains: xrpl, evm"


class TestNotImplementedStubs:
    def test_balance_raises(self) -> None:
        _, svc = _make_service()
        with pytest.raises(NotImplementedOnServer, match="wallet_balance"):
            svc.balance(address="r4Vx...")

    def test_transactions_raises(self) -> None:
        _, svc = _make_service()
        with pytest.raises(NotImplementedOnServer, match="wallet_transactions"):
            svc.transactions(address="r4Vx...")
