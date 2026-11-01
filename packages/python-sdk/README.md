# mangrovemarkets

[![PyPI Downloads](https://static.pepy.tech/badge/mangrovemarkets)](https://pepy.tech/projects/mangrovemarkets)

Python SDK for MangroveMarkets -- DEX aggregation, wallet management, and portfolio analytics for agents.

## Supported workflow matrix

| Workflow | Python entry point | TypeScript entry point | Boundary |
| --- | --- | --- | --- |
| DEX and wallet tools | `client.dex`, `client.wallet` | `client.dex`, `client.wallet` | Marketplace products, listings, offers and escrow are under construction even where client methods or schemas exist. Wallet creation is local and unfunded. |
| Kraken OAuth account access | `client.cex` | `client.cex` | Hosted Markets REST proxy: connect, status, balances, validate/place spot orders, list open orders, cancel. It does not expose broker positions. |
| MangroveAI strategies/backtests | Not included | Not included | Use the separate MangroveAI API clients. |

The SDK sends requested operations and returns Mangrove's result. Deterministic
risk management uses live market and account conditions and is owned by Mangrove;
the SDK and calling agent do not implement that policy. Order outcomes can be
ambiguous after a timeout, so CEX requests are not automatically retried. Inspect
connection and order state before deciding whether to submit another request.
See the [full capability and artifact matrix](../../docs/markets-sdk-capability-matrix.md).

### Kraken OAuth lifecycle

Configure a Mangrove API key, request `view` access for read-only account access
or `execute` access when order placement is needed, then open the returned
`authorize_url` for the user. Poll `client.cex.status()` after consent and read
balances. Use `validate_only=True` before requesting a live order. Mangrove holds
the OAuth grant; this API does not accept a caller-supplied Kraken key or user ID.
The available account surface has no positions method.

```python
import os
from mangrove_markets import MangroveMarkets

# Set both variables to your configured Markets API origin and Mangrove API key.
with MangroveMarkets(
    base_url=os.environ["MANGROVE_BASE_URL"],
    api_key=os.environ["MANGROVE_API_KEY"],
) as client:
    consent = client.cex.connect_start(mode="view")
    print(consent["authorize_url"])  # show/open this URL for the account owner
    status = client.cex.status()     # poll until connected after consent
    balances = client.cex.balances()
```

## Installation

```bash
pip install mangrovemarkets
```

> The package imports as `mangrove_markets` (e.g. `from mangrove_markets import MangroveMarkets`).
> The legacy `import mangrovemarkets` path also still works for backwards compatibility.

## Quickstart

The MangroveMarkets MCP server requires an API key for authenticated endpoints. You can pass it explicitly via the `api_key` parameter or set the `MANGROVE_API_KEY` environment variable (the SDK reads it automatically as a fallback).

```python
import os
from mangrove_markets import MangroveMarkets

client = MangroveMarkets(
    base_url=os.environ["MANGROVE_BASE_URL"],  # deployment-owner-confirmed API origin
    api_key=os.environ["MANGROVE_API_KEY"],
)

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

The client also works as a context manager (and picks up `MANGROVE_API_KEY` / `MANGROVE_BASE_URL` from the environment):

```python
with MangroveMarkets() as client:
    venues = client.dex.supported_venues()
```

For local development, point the client at a locally running MCP server:

```python
client = MangroveMarkets(base_url="http://localhost:8080", api_key=os.getenv("MANGROVE_API_KEY"))
```

## Getting an API key

1. Sign up at [https://mangrovedeveloper.ai](https://mangrovedeveloper.ai).
2. Go to **Settings -> API Keys -> Create**.
3. Copy the key -- it is shown only once.
4. Export it as `MANGROVE_API_KEY` or pass it directly to `MangroveMarkets(api_key=...)`:

   ```bash
   export MANGROVE_API_KEY="prod_..."
   ```

If you call the API without a valid key, the server returns HTTP 401 with this payload:

```json
{"detail": "Missing or malformed Authorization header. Expected: Bearer <api_key>"}
```

## Full swap flow

A DEX swap goes through six steps: quote, approve, prepare, sign locally, broadcast, and confirm.

```python
import os
from mangrove_markets import MangroveMarkets

client = MangroveMarkets(
    base_url=os.environ["MANGROVE_BASE_URL"],  # deployment-owner-confirmed API origin
    api_key=os.environ["MANGROVE_API_KEY"],
)

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

For EVM status reads, `status.raw` contains the original RPC receipt when one is
available, including logs, gas fields, and chain-specific fees. Pending reads have
`raw=None`. Verify its transaction hash, sender, destination, execution status,
and token transfers before treating a swap as filled. The response does not
convert native gas fees to quote currency or establish internal native transfers.

## Configuration

| Parameter | Env var | Default | Description |
|-----------|---------|---------|-------------|
| `base_url` | `MANGROVE_BASE_URL` | `http://localhost:8080` | Markets API/MCP server URL. For a hosted service, set the origin confirmed for that deployment. |
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

## Complete tool responses (unreleased)

Use `client.call_tool_result(name, arguments)` for content, structured data, tool
error flags, metadata and HTTP response headers. Existing service methods retain
successful return types. Full results require the server's opt-in `mcp-v1` format;
unsupported format errors must not cause automatic replay.

Install the distribution `mangrovemarkets`; import from `mangrove_markets`.
See [the response contract and migration notes](../../docs/t17-client-results.md).
