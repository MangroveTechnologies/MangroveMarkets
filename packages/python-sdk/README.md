# mangrovemarkets

Python SDK for MangroveMarkets -- DEX aggregation, wallet management, and portfolio analytics for agents.

## Installation

```bash
pip install mangrovemarkets
```

## Quickstart

```python
from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(base_url="http://localhost:8080")

# Chain info
info = client.wallet.chain_info(chain="evm")
print(f"Chain: {info.chain}, Native token: {info.native_token}")

# DEX venues
venues = client.dex.supported_venues()
for v in venues:
    print(f"  {v.id}: {v.name} ({v.chain}) - {v.supported_pairs_count} pairs")

# Portfolio value
value = client.portfolio.value(addresses="0xYOUR_WALLET_ADDRESS")
print(f"Total portfolio: ${value.total_value_usd:,.2f}")

client.close()
```

The client also works as a context manager:

```python
with MangroveMarkets() as client:
    venues = client.dex.supported_venues()
```

## Full swap flow

A DEX swap goes through six steps: quote, approve, prepare, sign locally, broadcast, and confirm.

```python
from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(base_url="http://localhost:8080")

# 1. Get a quote
quote = client.dex.get_quote(
    input_token="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # USDC on Base
    output_token="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",  # ETH
    amount=1_000_000,  # 1 USDC (6 decimals)
    chain_id=8453,
)
print(f"Quote: {quote.input_amount} -> {quote.output_amount} (rate: {quote.exchange_rate})")

# 2. Approve token spending (ERC-20 only, returns None if already approved)
approval = client.dex.approve_token(
    token_address="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chain_id=8453,
    wallet_address="0xYOUR_WALLET",
)
if approval:
    # Sign the approval tx with your local signer, then broadcast
    # signed_approval = your_signer.sign(approval.payload)
    # client.dex.broadcast(signed_tx=signed_approval, chain_id=8453)
    pass

# 3. Prepare the swap transaction
swap_tx = client.dex.prepare_swap(
    quote_id=quote.quote_id,
    wallet_address="0xYOUR_WALLET",
)

# 4. Sign locally (SDK never touches private keys)
# signed_swap = your_signer.sign(swap_tx.payload)

# 5. Broadcast
# result = client.dex.broadcast(signed_tx=signed_swap, chain_id=8453)

# 6. Confirm
# status = client.dex.tx_status(tx_hash=result.tx_hash, chain_id=8453)

client.close()
```

## Configuration

| Parameter | Env var | Default | Description |
|-----------|---------|---------|-------------|
| `base_url` | `MANGROVE_BASE_URL` | `http://localhost:8080` | MCP server URL |
| `api_key` | `MANGROVE_API_KEY` | `None` | API key for authenticated endpoints |
| `timeout` | -- | `30.0` | Request timeout in seconds |
| `max_retries` | -- | `3` | Max retries on 429/5xx |
| `auto_retry` | -- | `True` | Enable automatic retry with backoff |

## Examples

See the [examples/](examples/) directory for runnable scripts:

- **quickstart.py** -- chain info and DEX venues
- **swap_flow.py** -- full swap lifecycle
- **portfolio_check.py** -- portfolio value, P&L, and token holdings
- **e2e_swap.py** -- a real 0.1 USDC → ETH swap on Base mainnet (requires `web3` and a funded wallet; install with `pip install mangrovemarkets[e2e]` or `pip install web3`)

Run the end-to-end swap with:

```bash
E2E_SWAP_PRIVATE_KEY=0x... MANGROVE_API_KEY=prod_... python examples/e2e_swap.py
```

Costs a few cents in gas per run. Never runs in CI.

## Security

The SDK never stores or transmits private keys. All signing happens locally in your application. The `prepare_swap` and `approve_token` methods return unsigned transaction payloads that you sign with your own wallet/signer before broadcasting through `broadcast`.

## API reference

This SDK wraps the MangroveMarkets MCP Server REST API. For full tool documentation, parameter details, and response schemas, see the [MangroveMarkets-MCP-Server](https://github.com/MangroveTechnologies/MangroveMarkets-MCP-Server) repository.

## License

MIT
