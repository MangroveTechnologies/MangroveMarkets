"""End-to-end swap example: 0.1 USDC -> ETH on Base mainnet via 1inch.

This is the canonical happy-path flow through the Mangrove Markets Python SDK:

  1. Get a quote
  2. Get unsigned approval calldata (ERC-20 tokens only)
  3. Sign and broadcast the approval
  4. Wait for confirmation
  5. Get unsigned swap calldata
  6. Sign and broadcast the swap
  7. Wait for confirmation

The SDK never handles your private key. It returns unsigned transaction
payloads; you sign them locally with web3.py (or similar) and send the
signed hex back through the broadcast endpoint.

Requires a funded Base mainnet wallet (~0.1 USDC + a few cents of ETH for gas).
"""
from __future__ import annotations

import os
import sys
import time

from web3 import Web3

from mangrovemarkets import MangroveMarkets
from mangrovemarkets.models.dex import UnsignedTransaction

# Config
BASE_RPC = "https://mainnet.base.org"
CHAIN_ID = 8453
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
ETH_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
SWAP_AMOUNT = 100_000  # 0.1 USDC (6 decimals)


def sign_tx(w3: Web3, acct, payload: dict, chain_id: int) -> str:
    """Sign an unsigned tx payload from the SDK with a local private key."""
    tx = {
        "to": w3.to_checksum_address(payload["to"]),
        "data": payload["data"],
        "value": int(payload.get("value", "0")),
        "gas": int(payload.get("gas", 300_000)),
        "nonce": w3.eth.get_transaction_count(acct.address),
        "chainId": chain_id,
    }
    max_fee = payload.get("maxFeePerGas")
    if max_fee is not None:
        tx["maxFeePerGas"] = int(max_fee)
        tx["maxPriorityFeePerGas"] = int(payload.get("maxPriorityFeePerGas") or max_fee)
    else:
        tx["gasPrice"] = int(payload.get("gasPrice") or w3.eth.gas_price)
    signed = acct.sign_transaction(tx)
    return signed.raw_transaction.hex()


def wait_for_confirmation(client, tx_hash: str, chain_id: int, timeout: int = 180):
    """Poll tx_status until confirmed, failed, or timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        status = client.dex.tx_status(tx_hash=tx_hash, chain_id=chain_id)
        if status.status in ("confirmed", "failed"):
            return status
        time.sleep(5)
    raise TimeoutError(f"Tx {tx_hash} did not confirm within {timeout}s")


def main() -> int:
    private_key = os.environ.get("E2E_SWAP_PRIVATE_KEY")
    api_key = os.environ.get("MANGROVE_API_KEY")
    if not private_key or not api_key:
        print("Missing env vars. Set E2E_SWAP_PRIVATE_KEY and MANGROVE_API_KEY.", file=sys.stderr)
        return 1

    client = MangroveMarkets(api_key=api_key)
    w3 = Web3(Web3.HTTPProvider(BASE_RPC))
    acct = w3.eth.account.from_key(private_key)
    print(f"Wallet: {acct.address}")

    # 1. Quote
    quote = client.dex.get_quote(
        input_token=USDC, output_token=ETH_NATIVE,
        amount=SWAP_AMOUNT, venue_id="1inch", chain_id=CHAIN_ID,
    )
    print(f"Quote: {quote.input_amount} USDC -> {quote.output_amount} wei ETH")
    print(f"  quote_id: {quote.quote_id}")

    # 2. Approve (if needed for ERC-20)
    approval: UnsignedTransaction | None = client.dex.approve_token(
        token_address=USDC, chain_id=CHAIN_ID, wallet_address=acct.address,
    )
    if approval is not None:
        print("Approval required; signing and broadcasting...")
        signed_approval = sign_tx(w3, acct, approval.payload, CHAIN_ID)
        approval_result = client.dex.broadcast(signed_tx=signed_approval, chain_id=CHAIN_ID)
        print(f"  approval tx: {approval_result.tx_hash}")
        wait_for_confirmation(client, approval_result.tx_hash, CHAIN_ID)
        print("  approval confirmed")

    # 3. Prepare swap
    swap_tx = client.dex.prepare_swap(quote_id=quote.quote_id, wallet_address=acct.address)
    print(f"Swap tx prepared ({len(swap_tx.payload['data'])} bytes calldata)")

    # 4. Sign locally + broadcast
    signed_swap = sign_tx(w3, acct, swap_tx.payload, CHAIN_ID)
    result = client.dex.broadcast(signed_tx=signed_swap, chain_id=CHAIN_ID)
    print(f"Swap broadcast: {result.tx_hash}")

    # 5. Confirm
    status = wait_for_confirmation(client, result.tx_hash, CHAIN_ID)
    print(f"Status: {status.status} in block {status.block_number}")
    print(f"BaseScan: https://basescan.org/tx/{result.tx_hash}")
    return 0 if status.status == "confirmed" else 2


if __name__ == "__main__":
    sys.exit(main())
