"""Wallet operations.

KEYGEN IS CLIENT-SIDE. All keypairs are generated locally inside this SDK
process; secrets never traverse the wire. The remote MCP server plays NO
role in keypair generation — EVM via eth_account, XRPL via xrpl-py.

The only server interaction during wallet creation is for XRPL
testnet/devnet, where the server is asked to request faucet funding
for a locally-generated address. Even then, only the address (public
data) is sent — secrets stay local.

This is the SDK 0.2.0 architecture. SDK 0.1.x sent the chain/network
to the server's `wallet_create` tool, which generated the keypair
server-side and returned the plaintext over the wire — a known leak
surface that contributed to the 2026-04-24 EIP-7702 drain incident.
That code path is gone.
"""
from __future__ import annotations

from typing import Any

from ..exceptions import NotImplementedOnServer
from ..models.wallet import ChainInfo, WalletCreateResult
from ._base import BaseService

# Boilerplate warnings shown to the caller alongside every newly-created
# wallet. Same wording as the 0.1.x server-side response so call sites
# parsing `.warnings` keep working.
_WARNINGS = [
    "IMPORTANT: Save your wallet secret now. It will not be stored by Mangrove.",
    "Anyone with this secret can access your funds. Do not share it.",
    "Store secrets offline in a secure password manager or hardware wallet.",
]


class WalletService(BaseService):
    """Wallet management operations.

    Wallet creation is performed entirely locally. Network calls during
    creation are limited to address-only operations (e.g. requesting
    testnet faucet funding for a public address).
    """

    def chain_info(self, chain: str = "xrpl") -> ChainInfo:
        """Get chain configuration. Use before creating a wallet."""
        return self._call_tool_model("wallet_chain_info", ChainInfo, {"chain": chain})

    def create(
        self,
        chain: str = "evm",
        network: str = "mainnet",
        chain_id: int | None = None,
    ) -> WalletCreateResult:
        """Create a new wallet. Keypair generated **locally**.

        The private key, secret, or seed phrase NEVER touches the wire.

        For XRPL testnet/devnet, the server is contacted only to request
        faucet funding for the locally-generated address.

        Args:
            chain: ``"evm"`` (default), ``"xrpl"``, or ``"solana"``.
            network: For XRPL — ``"testnet"`` / ``"devnet"`` / ``"mainnet"``.
                For EVM — informational only; the keypair is chain-agnostic
                and can be funded on any EVM chain.
            chain_id: For EVM — the chain id to record on the result
                (1=Ethereum, 8453=Base, 42161=Arbitrum, etc.). Does not
                affect the keypair.

        Returns:
            ``WalletCreateResult`` with the address and the secret material
            (``private_key`` for EVM, ``secret`` + ``seed_phrase`` for XRPL).
            The secret is returned ONLY to the caller — save it; it cannot
            be recovered from the server.
        """
        chain_norm = chain.lower()
        if chain_norm == "evm":
            return self._create_evm(network=network, chain_id=chain_id)
        if chain_norm == "xrpl":
            return self._create_xrpl(network=network)
        if chain_norm == "solana":
            raise NotImplementedError(
                "Solana wallet creation is not yet implemented in the SDK. "
                "Track: https://github.com/MangroveTechnologies/MangroveMarkets/issues"
            )
        raise ValueError(
            f"Unsupported chain: {chain!r}. Supported: 'evm', 'xrpl'."
        )

    # ------------------------------------------------------------------
    # EVM
    # ------------------------------------------------------------------

    def _create_evm(
        self, network: str, chain_id: int | None,
    ) -> WalletCreateResult:
        """Locally generate a fresh EVM keypair."""
        try:
            from eth_account import Account
        except ImportError as e:  # pragma: no cover
            raise ImportError(
                "eth_account is required for EVM wallet creation. "
                "Install with: pip install eth_account>=0.13"
            ) from e

        acct = Account.create()
        private_key_hex = "0x" + acct.key.hex()
        return WalletCreateResult(
            address=acct.address,
            private_key=private_key_hex,
            chain="evm",
            chain_id=chain_id,
            network=network,
            is_funded=False,
            warnings=list(_WARNINGS),
        )

    # ------------------------------------------------------------------
    # XRPL
    # ------------------------------------------------------------------

    def _create_xrpl(self, network: str) -> WalletCreateResult:
        """Locally generate a fresh XRPL keypair using xrpl-py."""
        try:
            from xrpl.wallet import Wallet
        except ImportError as e:  # pragma: no cover
            raise ImportError(
                "xrpl-py is required for XRPL wallet creation. "
                "Install with: pip install xrpl-py>=4.0.0"
            ) from e

        wallet = Wallet.create()
        return WalletCreateResult(
            address=wallet.classic_address,
            secret=wallet.seed,
            chain="xrpl",
            network=network,
            is_funded=False,
            warnings=list(_WARNINGS),
        )

    # ------------------------------------------------------------------
    # Server stubs (unchanged)
    # ------------------------------------------------------------------

    def balance(self, address: str, chain: str = "xrpl") -> Any:
        """Check wallet balance. NOT_IMPLEMENTED on server (Phase 1)."""
        raise NotImplementedOnServer(
            "wallet_balance is not yet implemented on the server (Phase 1)"
        )

    def transactions(self, address: str, chain: str = "xrpl", limit: int = 50) -> Any:
        """List wallet transactions. NOT_IMPLEMENTED on server (Phase 1)."""
        raise NotImplementedOnServer(
            "wallet_transactions is not yet implemented on the server (Phase 1)"
        )
