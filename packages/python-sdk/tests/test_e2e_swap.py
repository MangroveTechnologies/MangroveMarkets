"""End-to-end swap test on Base mainnet via 1inch.

Performs a real on-chain swap of a tiny amount (0.1 USDC -> ETH) through
the full SDK surface: quote -> approve -> prepare -> sign locally -> broadcast -> confirm.

Gated by E2E_SWAP_PRIVATE_KEY env var to prevent accidental execution.
Costs a few cents in gas per run. Never runs in CI.

Usage:
    pip install -e ".[dev,e2e]"
    E2E_SWAP_PRIVATE_KEY=0x... \\
    MANGROVE_TEST_API_KEY=prod_... \\
    pytest tests/test_e2e_swap.py -v -s
"""
from __future__ import annotations

import os
import time

import pytest

try:
    from web3 import Web3

    WEB3_AVAILABLE = True
except ImportError:
    WEB3_AVAILABLE = False

from mangrovemarkets import MangroveMarkets
from mangrovemarkets.models.dex import (
    BroadcastResult,
    Quote,
    TransactionStatus,
    UnsignedTransaction,
)

E2E_KEY = os.environ.get("E2E_SWAP_PRIVATE_KEY")
LIVE_URL = os.environ.get("MANGROVE_TEST_URL", "https://mangrovemarkets-pcqgpciucq-uc.a.run.app")
API_KEY = os.environ.get("MANGROVE_TEST_API_KEY") or os.environ.get("MANGROVE_API_KEY")

pytestmark = pytest.mark.skipif(
    E2E_KEY is None or API_KEY is None or not WEB3_AVAILABLE,
    reason="E2E_SWAP_PRIVATE_KEY, MANGROVE_TEST_API_KEY, and web3 required",
)

CHAIN_ID = 8453  # Base mainnet
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
ETH_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
SWAP_AMOUNT = 100_000  # 0.1 USDC (6 decimals)
BASE_RPC = "https://mainnet.base.org"


def test_full_swap_flow_base_mainnet_1inch():
    """Quote -> approve -> prepare -> sign -> broadcast -> confirm.

    Prints each step so `pytest -s` shows progress.
    """
    client = MangroveMarkets(base_url=LIVE_URL, api_key=API_KEY)
    w3 = Web3(Web3.HTTPProvider(BASE_RPC))
    acct = w3.eth.account.from_key(E2E_KEY)
    print(f"\nWallet: {acct.address}")

    # 1. Quote
    quote = client.dex.get_quote(
        input_token=USDC,
        output_token=ETH_NATIVE,
        amount=SWAP_AMOUNT,
        venue_id="1inch",
        chain_id=CHAIN_ID,
    )
    assert isinstance(quote, Quote)
    assert quote.output_amount > 0
    print(f"1. Quote: {quote.input_amount} USDC -> {quote.output_amount} wei ETH "
          f"(rate: {quote.exchange_rate}, quote_id: {quote.quote_id})")

    # 2. Approve (ERC-20) -- only needed if allowance is insufficient
    approval = client.dex.approve_token(
        token_address=USDC,
        chain_id=CHAIN_ID,
        wallet_address=acct.address,
    )
    if approval is not None:
        assert isinstance(approval, UnsignedTransaction)
        print(f"2. Approval needed, signing and broadcasting...")
        signed = _sign_tx(w3, acct, approval.payload, CHAIN_ID)
        approval_result = client.dex.broadcast(
            signed_tx=signed, chain_id=CHAIN_ID,
        )
        assert isinstance(approval_result, BroadcastResult)
        print(f"   Approval tx: {approval_result.tx_hash}")
        _wait_for_confirmation(client, approval_result.tx_hash, CHAIN_ID)
    else:
        print("2. Approval not needed (sufficient allowance or native token)")

    # 3. Prepare swap (get unsigned tx calldata)
    swap_tx = client.dex.prepare_swap(
        quote_id=quote.quote_id,
        wallet_address=acct.address,
    )
    assert isinstance(swap_tx, UnsignedTransaction)
    assert swap_tx.chain_family == "evm"
    assert "to" in swap_tx.payload
    print(f"3. Swap tx prepared (to={swap_tx.payload['to']}, gas={swap_tx.payload.get('gas')})")

    # 4. Sign locally (SDK never sees the private key)
    signed_swap = _sign_tx(w3, acct, swap_tx.payload, CHAIN_ID)

    # 5. Broadcast
    result = client.dex.broadcast(
        signed_tx=signed_swap, chain_id=CHAIN_ID,
    )
    assert isinstance(result, BroadcastResult)
    print(f"5. Swap broadcast: {result.tx_hash}")

    # 6. Confirm on-chain
    status = _wait_for_confirmation(client, result.tx_hash, CHAIN_ID)
    assert isinstance(status, TransactionStatus)
    assert status.status == "confirmed"
    print(f"6. Confirmed in block {status.block_number}")
    print(f"   BaseScan: https://basescan.org/tx/{result.tx_hash}")


def _sign_tx(w3: "Web3", acct, payload: dict, chain_id: int) -> str:
    """Sign an unsigned tx payload with the account's private key."""
    tx = {
        "to": w3.to_checksum_address(payload["to"]),
        "data": payload["data"],
        "value": int(payload.get("value", "0")),
        "gas": int(payload.get("gas", 300_000)),
        "nonce": w3.eth.get_transaction_count(acct.address),
        "chainId": chain_id,
    }
    # Use EIP-1559 fees if available, fall back to legacy gasPrice
    max_fee = payload.get("maxFeePerGas")
    if max_fee is not None:
        tx["maxFeePerGas"] = int(max_fee)
        tx["maxPriorityFeePerGas"] = int(payload.get("maxPriorityFeePerGas") or max_fee)
    else:
        gas_price = payload.get("gasPrice") or w3.eth.gas_price
        tx["gasPrice"] = int(gas_price)

    signed = acct.sign_transaction(tx)
    return signed.raw_transaction.hex()


def _wait_for_confirmation(
    client: MangroveMarkets, tx_hash: str, chain_id: int, timeout: int = 180
) -> TransactionStatus:
    """Poll tx_status until confirmed, failed, or timeout."""
    deadline = time.time() + timeout
    last_status = None
    while time.time() < deadline:
        status = client.dex.tx_status(tx_hash=tx_hash, chain_id=chain_id)
        if status.status != last_status:
            print(f"   ...status: {status.status}")
            last_status = status.status
        if status.status in ("confirmed", "failed"):
            return status
        time.sleep(5)
    raise TimeoutError(f"Tx {tx_hash} did not confirm within {timeout}s")
