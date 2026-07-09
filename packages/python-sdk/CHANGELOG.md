# Changelog

All notable changes to the `mangrove-markets` Python SDK are documented here.

## Unreleased

### Added

- **`client.cex.*` — keyless CEX (Kraken) service surface.** Connect, balances,
  and orders on the user's OAuth-linked Kraken account via the MangroveMarkets
  platform proxy — no venue key held by the caller (`connect_start`, `status`,
  `balances`, `place_order`, `open_orders`, `cancel_order`; `user_id` derived
  server-side). The BYOK alternative remains the top-level `KrakenClient`.

## 1.0.0 — 2026-05-26

### Renamed (breaking)

- **PyPI distribution: `mangrovemarkets` → `mangrove-markets`.** Install
  with `pip install mangrove-markets`. The old `mangrovemarkets` package
  receives one final `0.1.3` release containing a `DeprecationWarning`
  and stops updating.
- **Python import: `from mangrovemarkets import …` → `from mangrove_markets import …`.**
  (Python module names use underscores; PyPI distribution names use
  hyphens — same convention as `scikit-learn` / `sklearn`.)
- **Git tag: `python-sdk-v1.0.0`** (the monorepo `python-sdk-v*` prefix
  pattern continues).

Rationale: aligns Python naming with the TypeScript SDK
(`@mangrove-ai/sdk`) and the rebranded `mangrove-ai` Python SDK. The
`MangroveMarkets` client class name, every method, every model — all
unchanged.

```diff
- pip install mangrovemarkets
+ pip install mangrove-markets
```
```diff
- from mangrovemarkets import MangroveMarkets
+ from mangrove_markets import MangroveMarkets
```

### Production stability

- `Development Status :: 3 - Alpha` → `5 - Production/Stable`. The 1.0
  release commits to semver compatibility going forward.

## 0.2.0 — 2026-05-04

**Architectural change. Wallet keygen moved client-side. Read this in full.**

### What changed

`WalletService.create(chain, network, chain_id)` no longer contacts the
server's `wallet_create` tool for keypair generation. The keypair is
now generated **locally, in the SDK process**, and the secret material
is returned to the caller without ever traversing the wire.

- **EVM** — `eth_account.Account.create()` runs locally. Returns
  `WalletCreateResult.private_key`. Zero HTTP traffic.
- **XRPL** — temporarily raises `NotImplementedError`. The client-side
  flow needs `xrpl-py`, which currently pins `httpx<0.25.0` while this
  SDK requires `httpx>=0.27.0`. Server-side XRPL keygen is also
  removed in `MangroveMarkets-MCP-Server` 0.2 — nobody creates XRPL
  wallets via SDK or via the server. Returns when `xrpl-py` relaxes
  its httpx pin.
- **Solana** — `WalletService.create(chain="solana")` now raises
  `NotImplementedError`. (Was previously a server-side
  "coming in Phase 3" stub; client-side equivalent pending.)

### Why

The 0.1.x server-side keygen path placed every newly-created private
key in: the server's process memory, the HTTPS response body, any
logging / observability tap on that response, and (transitively, when
the response was rendered into agent conversation context) upstream LLM
providers' API logs.

That was the leak surface that contributed to the 2026-04-24 EIP-7702
drain incident. Closing it required removing the server's ability to
mint a key on a caller's behalf. The corrected architecture is "the
SDK process is the only place a private key exists." This release
implements that.

### Caller compatibility

- Response shape (`WalletCreateResult`) is unchanged.
- Default chain changed from `"xrpl"` to `"evm"`. Pass `chain="xrpl"`
  explicitly going forward if you were relying on the implicit default.
- `chain="solana"` now raises locally instead of returning a
  server-side `NOT_IMPLEMENTED` error.

### Server compatibility

This SDK release does NOT require the server to ship anything new for
EVM users — EVM keygen is fully local. The corresponding
`MangroveMarkets-MCP-Server` 0.2 release **disables `wallet_create`
for ALL chains** (returns `NOT_IMPLEMENTED`) — the leak surface is
removed at the server layer too, not just bypassed by the SDK.

### Dependencies

- Added `eth_account>=0.13.0,<1.0` to core dependencies.
- `xrpl-py` not added (deps conflict — see above).

### Tests

`tests/test_wallet.py` rewritten. Critical regression assertions:
- `test_does_not_call_server` — EVM keygen issues zero HTTP requests.
- `test_returns_valid_keypair` — returned address derives from returned
  private_key (catches inconsistent generation that would lock callers
  out of their own wallets).
- `test_testnet_calls_faucet_with_address_only` — XRPL testnet faucet
  relay sends only `{address, network}` in the request body, with a
  belt-and-suspenders substring check that the secret is not present.

## 0.1.2 — 2026-04-24

### Fixed

- **`dex.token_info()`**: unwrap the server's `{"token": {...}}` envelope before
  validating against `TokenInfo`. Previously every call raised 4 pydantic
  validation errors because the SDK expected flat fields. (#62)
- **`dex.chart()`**: updated to match the current server contract. 1inch removed
  the pair-based OHLCV endpoint; the `oneinch_chart` server tool now takes a
  single `address` and a `timerange`. (#63)

### Breaking

- **`DexService.chart(chain_id, token0, token1, period)` → `DexService.chart(chain_id, address, timerange="1month")`**.
  The old signature 500'd on every call against a 0.1.1 server, so this breakage
  is symbolic — no working caller is depending on the old kwargs. Callers that
  passed `token0`/`token1`/`period` now raise a clear `TypeError`.

## 0.1.1 — 2026-04-22

Previously published to PyPI (see git tag `python-sdk-v0.1.1`).

## 0.1.0 — 2026-04-18

Initial release.
