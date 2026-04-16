"""Full DEX swap flow: quote -> approve -> prepare -> sign -> broadcast -> confirm."""

from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(base_url="http://localhost:8080")

# 1. Get quote
quote = client.dex.get_quote(
    input_token="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # USDC on Base
    output_token="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",  # ETH
    amount=1_000_000,  # 1 USDC (6 decimals)
    chain_id=8453,
)
print(f"Quote: {quote.input_amount} -> {quote.output_amount} (rate: {quote.exchange_rate})")

# 2. Approve token (ERC-20 only)
approval = client.dex.approve_token(
    token_address="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chain_id=8453,
    wallet_address="YOUR_WALLET_ADDRESS",
)
if approval:
    print(f"Sign approval tx locally: {approval.payload}")
    # signed_approval = your_signer.sign(approval.payload)
    # client.dex.broadcast(signed_tx=signed_approval, chain_id=8453)

# 3. Prepare swap
swap_tx = client.dex.prepare_swap(quote_id=quote.quote_id, wallet_address="YOUR_WALLET_ADDRESS")
print(f"Sign swap tx locally: {swap_tx.payload}")

# 4-6. Sign locally, broadcast, check status
# signed_swap = your_signer.sign(swap_tx.payload)
# result = client.dex.broadcast(signed_tx=signed_swap, chain_id=8453)
# status = client.dex.tx_status(tx_hash=result.tx_hash, chain_id=8453)

client.close()
