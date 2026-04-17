# MangroveMarkets Python SDK (PyPI) -- Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Package name:** `mangrovemarkets`
**Version:** 0.1.0
**PyPI:** https://pypi.org/project/mangrovemarkets/

## Purpose

Publish a Python SDK to PyPI that gives Python-based agents typed, ergonomic access to the MangroveMarkets MCP server via REST. This is the Python counterpart to `@mangrove-ai/sdk` (TypeScript) and architecturally mirrors `mangroveai` (MangroveAI Python SDK).

## Scope

### In scope (v0.1.0)

- **Wallet + DEX operations only** (wallet, dex swap flow, market data, portfolio analytics)
- REST transport only (httpx sync client)
- Pydantic v2 models for all request/response types
- Transport abstraction layer (protocol interface) to support future MCP transport
- `NOT_IMPLEMENTED` stubs for Phase 2+ tools (raise `NotImplementedError` with phase info)
- pytest + respx test suite
- GitHub Actions release workflow (workflow_dispatch, PyPI via `PYPI_API_TOKEN` secret from GCP)
- README with quickstart and examples

### Out of scope (deferred)

- Marketplace service (v0.2+)
- Async client (v0.2)
- MCP transport (v0.2+, transport protocol is ready for it)
- Signer abstraction (not needed -- server returns unsigned payloads, agent signs locally)
- Solana wallet support (Phase 3 on server side)

## API Design Rationale

### Why `dex` + `portfolio` instead of `dex` + `oneinch`

The MCP server's tool prefixes (`dex_*`, `oneinch_*`) reflect which backend powers each tool. But the SDK is designed for **agent intent**, not server internals. An agent shouldn't need to know that 1inch powers spot prices or that XPMarket handles XRPL swaps.

The `oneinch_*` tools fall into two categories:
- **Pre-trade utilities** (spot_price, gas_price, balances, allowances, token_search, token_info, chart) -- things an agent checks *before* or *around* a swap. These belong on `dex`.
- **Portfolio analytics** (portfolio_value, portfolio_pnl, portfolio_tokens, portfolio_defi, history) -- cross-chain read-only analytics. These are a separate concern.

Having `client.dex.supported_venues()` return `"1inch"` as a venue while also exposing `client.oneinch` as a peer namespace is contradictory. The venue is a routing detail the server handles.

### Forward compatibility

When new venues are implemented (Jupiter for Solana is stubbed, XPMarket for XRPL is live), the SDK requires zero changes:
- **Swap flow**: `dex.get_quote()` already accepts `venue_id` -- the server routes to the right adapter.
- **Market data**: Methods like `spot_price()` and `balances()` accept `chain_id` -- the server can route to the appropriate backend (1inch for EVM, native RPC for XRPL/Solana) without changing the SDK signature.
- **Portfolio**: If XRPL portfolio analytics are added later, `portfolio.value(addresses="r4Vx...")` works with the same method signature -- the server routes by address format or explicit chain_id.

The SDK mirrors the MCP tool interface, not the venue internals. As long as tool signatures are stable, the SDK is insulated from venue additions.

## Security Invariant

**No private key, seed, or secret ever passes through the SDK except in the one-time `wallet_create` response (returned to the local caller).** The SDK:
- Never stores secrets
- Never accepts secrets as parameters (except `signed_tx` hex blobs for broadcast)
- Never transmits secrets over the network
- Returns unsigned transaction payloads for local signing

This matches the MCP server's own invariant (line 5 of `wallet/tools.py` and `dex/tools.py`).

## Architecture

### Package layout

```
packages/python-sdk/
  pyproject.toml
  README.md
  src/
    mangrovemarkets/
      __init__.py
      _version.py
      _client.py            # MangroveMarkets main client class
      _config.py             # ClientConfig dataclass
      exceptions.py          # Exception hierarchy
      py.typed               # PEP 561 typed package marker
      _transport/
        __init__.py
        _protocol.py         # Transport protocol (ABC)
        _http.py             # HttpTransport (httpx sync)
        _retry.py            # RetryConfig + backoff logic
        _service.py          # ServiceTransport (base_url + auth + transport)
        _auth.py             # ApiKeyAuth, NoAuth
      models/
        __init__.py
        _base.py             # Base model config
        wallet.py            # ChainInfo, WalletCreateResult
        dex.py               # Quote, UnsignedTransaction, BroadcastResult, TxStatus, Venue, TradingPair
        market_data.py       # Balances, SpotPrice, GasPrice, TokenInfo, ChartData
        portfolio.py         # PortfolioValue, PortfolioPnL, PortfolioTokens, PortfolioDefi, TxHistory
        shared.py            # ToolResponse wrapper, ErrorResponse
      _services/
        __init__.py
        _base.py             # BaseService with transport ref
        wallet.py            # WalletService
        dex.py               # DexService (swap flow + market data utilities)
        portfolio.py         # PortfolioService (cross-chain read-only analytics)
  tests/
    conftest.py              # Shared fixtures, respx mocks
    test_wallet.py
    test_dex.py
    test_portfolio.py
    test_client.py
    test_transport.py
  examples/
    quickstart.py
    swap_flow.py
    portfolio_check.py
```

### Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Build system | hatchling + pyproject.toml | Matches MangroveAI-SDK |
| Models | Pydantic v2 | Validation + JSON schema; matches MCP-server stack |
| HTTP client | httpx (sync) | Matches MangroveAI-SDK; clean async upgrade path |
| Transport | Protocol ABC + REST impl | Future MCP transport plugs in without touching services |
| Services | cached_property lazy loading | Matches MangroveAI-SDK pattern |
| Tests | pytest + respx | Matches MangroveAI-SDK; respx mocks httpx natively |
| Linting | ruff | Matches MangroveAI-SDK |
| Release | workflow_dispatch + tag + PyPI | Matches MangroveAI-SDK release.yml |
| Version | 0.1.0 | Alpha; matches MangroveAI-SDK starting version |
| Async | Deferred to v0.2 | MangroveAI-SDK is sync-only today |
| Python | >=3.10 | Matches MangroveAI-SDK |

### Client API surface

```python
from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(base_url="https://api.mangrovemarkets.com")

# -- Wallet --
client.wallet.chain_info(chain="evm")                     # wallet_chain_info
client.wallet.create(chain="xrpl", network="testnet")      # wallet_create
client.wallet.balance(address="r4Vx...")                    # wallet_balance (NOT_IMPLEMENTED)
client.wallet.transactions(address="r4Vx...")               # wallet_transactions (NOT_IMPLEMENTED)

# -- DEX: swap flow --
client.dex.supported_venues()                               # dex_supported_venues
client.dex.supported_pairs(venue_id="1inch")                # dex_supported_pairs
client.dex.get_quote(                                       # dex_get_quote
    input_token="0x833...", output_token="0xEee...",
    amount=1_000_000, chain_id=8453
)
client.dex.approve_token(                                   # dex_approve_token
    token_address="0x833...", chain_id=8453,
    wallet_address="0xbf5..."
)
client.dex.prepare_swap(quote_id="...", wallet_address="0xbf5...")  # dex_prepare_swap
client.dex.broadcast(signed_tx="0xabc...", chain_id=8453)           # dex_broadcast
client.dex.tx_status(tx_hash="0xc29...", chain_id=8453)             # dex_tx_status

# -- DEX: market data & token utilities --
client.dex.spot_price(chain_id=8453, tokens="0x833...")              # oneinch_spot_price
client.dex.gas_price(chain_id=8453)                                  # oneinch_gas_price
client.dex.balances(chain_id=8453, wallet="0xbf5...")                # oneinch_balances
client.dex.allowances(chain_id=8453, wallet="0xbf5...", spender="0x111...")  # oneinch_allowances
client.dex.token_search(chain_id=8453, query="USDC")                # oneinch_token_search
client.dex.token_info(chain_id=8453, address="0x833...")             # oneinch_token_info
client.dex.chart(chain_id=8453, token0="0x...", token1="0x...", period="1h")  # oneinch_chart

# -- Portfolio: cross-chain read-only analytics --
client.portfolio.value(addresses="0xbf5...", chain_id=None)          # oneinch_portfolio_value
client.portfolio.pnl(addresses="0xbf5...")                           # oneinch_portfolio_pnl
client.portfolio.tokens(addresses="0xbf5...")                        # oneinch_portfolio_tokens
client.portfolio.defi(addresses="0xbf5...")                          # oneinch_portfolio_defi
client.portfolio.history(address="0xbf5...", limit=50)               # oneinch_history
```

**Design note:** The `oneinch_*` MCP tools are mapped to `dex.*` (pre-trade utilities) and `portfolio.*` (analytics) based on agent intent, not server backend. The MCP tool name is shown as a comment for traceability. When the server adds non-1inch backends for these capabilities (e.g., native XRPL balance checks, Solana portfolio analytics), the SDK method signatures remain stable -- the server handles routing internally.

### Transport protocol

```python
from typing import Any, Protocol

class Transport(Protocol):
    """Abstract transport -- REST today, MCP later."""
    def request(self, method: str, path: str, **kwargs: Any) -> Any: ...
    def close(self) -> None: ...
```

Services accept a `ServiceTransport` which wraps a `Transport` with base_url and auth. When we add MCP transport, we implement this protocol with MCP client calls. Services don't change.

### Error handling

Exception hierarchy:
```
MangroveError (base)
  +-- ApiError (HTTP 4xx/5xx with status_code, code, message, suggestion)
  +-- AuthenticationError (401)
  +-- ValidationError (422)
  +-- RateLimitError (429)
  +-- NotImplementedError (tool exists but is NOT_IMPLEMENTED on server)
  +-- NetworkError (connection/timeout)
  +-- ConfigurationError (bad client config)
```

All exceptions carry structured fields that agents can parse programmatically, matching the MCP server's error format (`error`, `code`, `message`, `suggestion`).

### Dependencies

```toml
[project]
dependencies = [
    "httpx>=0.27.0,<1.0",
    "pydantic>=2.0,<3.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pytest-cov>=4.0",
    "respx>=0.22",
    "ruff>=0.4",
    "mypy>=1.10",
]
```

### CI/CD

**Test workflow** (`ci.yml`): Runs on PR to main. pytest + ruff + mypy. Matrix: Python 3.10, 3.11, 3.12.

**Release workflow** (`release.yml`): workflow_dispatch with bump type (patch/minor/major). Steps:
1. Checkout + install
2. Run tests
3. Compute next version from git tags
4. Update `pyproject.toml` + `_version.py`
5. Commit, tag, push
6. Build with `python -m build`
7. Verify built version matches
8. Publish via `pypa/gh-action-pypi-publish` using `secrets.PYPI_API_TOKEN`
9. Create GitHub Release with release notes

Mirrors MangroveAI-SDK's `release.yml` exactly.

### Tool-to-method mapping

| MCP Tool | SDK Service | SDK Method | Status |
|---|---|---|---|
| `wallet_chain_info` | wallet | `chain_info()` | Implemented |
| `wallet_create` | wallet | `create()` | Implemented |
| `wallet_balance` | wallet | `balance()` | NOT_IMPLEMENTED (Phase 1) |
| `wallet_transactions` | wallet | `transactions()` | NOT_IMPLEMENTED (Phase 1) |
| `dex_supported_venues` | dex | `supported_venues()` | Implemented |
| `dex_supported_pairs` | dex | `supported_pairs()` | Implemented |
| `dex_get_quote` | dex | `get_quote()` | Implemented |
| `dex_approve_token` | dex | `approve_token()` | Implemented |
| `dex_prepare_swap` | dex | `prepare_swap()` | Implemented |
| `dex_broadcast` | dex | `broadcast()` | Implemented |
| `dex_tx_status` | dex | `tx_status()` | Implemented |
| `oneinch_balances` | dex | `balances()` | Implemented |
| `oneinch_allowances` | dex | `allowances()` | Implemented |
| `oneinch_spot_price` | dex | `spot_price()` | Implemented |
| `oneinch_gas_price` | dex | `gas_price()` | Implemented |
| `oneinch_token_search` | dex | `token_search()` | Implemented |
| `oneinch_token_info` | dex | `token_info()` | Implemented |
| `oneinch_chart` | dex | `chart()` | Implemented |
| `oneinch_portfolio_value` | portfolio | `value()` | Implemented |
| `oneinch_portfolio_pnl` | portfolio | `pnl()` | Implemented |
| `oneinch_portfolio_tokens` | portfolio | `tokens()` | Implemented |
| `oneinch_portfolio_defi` | portfolio | `defi()` | Implemented |
| `oneinch_history` | portfolio | `history()` | Implemented |

### REST endpoint pattern

All MCP tools are auto-bridged to REST at:
```
POST /api/v1/tools/<tool_name>
Content-Type: application/json
Body: { ...tool parameters... }
```

The SDK maps each service method to the corresponding `POST /api/v1/tools/<tool_name>` call.

## Test strategy

- **Unit tests**: Every service method mocked via respx. Verify request shape, response parsing, error handling.
- **Transport tests**: Test retry logic, auth header injection, error mapping.
- **Integration tests** (gated by `@pytest.mark.integration` + `MANGROVE_TEST_URL` env var): Hit a live testnet MCP server. Not run in CI by default.
- **Coverage target**: 90%+ on service + transport layers.

## Pre-publish checklist

- [ ] `PYPI_API_TOKEN` added to MangroveMarkets repo secrets (from GCP Secret Manager)
- [ ] `mangrovemarkets` project created on PyPI (first publish creates it, or reserve the name)
- [ ] `py.typed` marker file included for PEP 561 typed package support
- [ ] README renders correctly on PyPI (test with `twine check dist/*`)
