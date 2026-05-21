---
type: session-notes
scope: phase2-demo
branch: demo/phase2-e2e-transaction
date: 2026-05-21
status: in-progress
---

# Phase 2 Demo — Session Notes

## What Was Done

### demo-part6.mjs (packages/sdk/demo-part6.mjs)
An 18-step automated end-to-end demo script covering the full Phase 2 integration. Run with `node demo-part6.mjs` from `packages/sdk/` with the MCP server running at `http://localhost:8080`.

Steps covered:
1. Server health check (`GET /health`)
2. TypeScript SDK connect via MCP Streamable HTTP (`McpTransport`)
3. Chain info (`wallet_chain_info`), DEX venues (`dex_supported_venues`), XPMarket pairs (`dex_supported_pairs`)
4. Client-side XRPL keypair generation for seller + buyer (`XrplSigner.generate()`) — seeds kept in-process
5. Faucet funding for both wallets (`xrpl_request_faucet_funding`)
6. XRPL balance check (`WalletService.xrplBalance`)
7. Transaction history (`WalletService.xrplTransactions`)
8. Marketplace listing creation (`MarketplaceService.createListing`)
9. Marketplace search (`MarketplaceService.search`)
10. Make offer — XRP escrow path (`MarketplaceService.makeOffer`)
11. Prepare unsigned EscrowCreate (`MarketplaceService.createEscrow`) — `finish_after: now + 15s`
12. EscrowMonitor state check — shows `PENDING` (not yet broadcast)
13. Sign EscrowCreate with `XrplSigner.fromSeed(buyerSeed)` + broadcast via `wallet_xrpl_broadcast`
14. Wait 20s — covers testnet confirmation (~4-8s) and `finish_after` expiry (15s)
15. Seller accepts offer (`marketplace_accept_offer` with `escrow_sequence`) — server does live XRPL `AccountObjects` verification
16. Buyer confirms delivery (`marketplace_confirm_delivery`) — returns `escrow_finish_params`
17. Sign EscrowFinish + broadcast via `wallet_xrpl_broadcast` to release XRP to seller
18. Final balance check — proves XRP moved on-chain

---

## Phase 2 Plan Coverage

Reference: `MangroveMarkets-MCP-Server/docs/plans/2026-03-11-phase2-integration.md`

The Phase 2 plan has 6 parts. Status of each as of this demo session:

### Part 1 — XPMarket Adapter
**Status: partial**

| Tool | Status | Notes |
|------|--------|-------|
| `dex_supported_venues` | ✅ demoed | Returns XPMarket, 1inch, Jupiter |
| `dex_supported_pairs` | ✅ demoed | Returns 5 XPMarket pairs |
| `dex_get_quote` | ⚠️ testnet-only limitation | Fails on testnet — USDC/RLUSD issuer addresses are mainnet-only, no liquidity on testnet |
| `dex_prepare_swap` | ❌ not tested | Not covered in demo |
| `dex_broadcast` | ❌ not tested | Not covered in demo |
| `dex_get_swap_status` | ❌ not tested | Not covered in demo |

### Part 2 — XRPL Wallet Completion
**Status: mostly complete**

| Tool | Status | Notes |
|------|--------|-------|
| `wallet_xrpl_balance` | ✅ demoed | Via `WalletService.xrplBalance` — shows balance + available (balance minus 10 XRP reserve) |
| `wallet_xrpl_transactions` | ✅ demoed | Via `WalletService.xrplTransactions` — lists tx type, amount, status, hash |
| `wallet_xrpl_send` | ❌ not tested | Implemented on server; not exercised in demo |
| `xrpl_request_faucet_funding` | ✅ demoed | Used to fund both seller and buyer wallets |

### Part 3 — XRPL Escrow Service
**Status: complete**

| Tool | Status | Notes |
|------|--------|-------|
| `escrow_create` | ✅ demoed | Returns unsigned EscrowCreate tx with `Sequence`, `Amount`, `FinishAfter` |
| `escrow_release` | ✅ demoed | Returns unsigned EscrowFinish tx; buyer signs + broadcasts |
| `escrow_cancel` | ❌ not tested | Implemented on server; not exercised in demo |

### Part 4 — Marketplace Settlement on XRPL
**Status: complete (XRP path); not testable (RLUSD/x402 path)**

| Flow | Status | Notes |
|------|--------|-------|
| XRP escrow — create listing | ✅ demoed | `marketplace_create_listing` with `price_xrp` |
| XRP escrow — search | ✅ demoed | `marketplace_search` — required `X402_ENABLED=false` fix |
| XRP escrow — make offer | ✅ demoed | `marketplace_make_offer` returns `offer_id` + `escrow_params` |
| XRP escrow — accept offer | ✅ demoed | `marketplace_accept_offer` with `escrow_sequence` — server does live XRPL `AccountObjects` verification |
| XRP escrow — confirm delivery | ✅ demoed | `marketplace_confirm_delivery` returns `escrow_finish_params` |
| XRP escrow — EscrowFinish | ✅ demoed | Buyer signs + broadcasts; XRP moves to seller |
| RLUSD via x402 | ❌ not testable | Requires live t54.ai facilitator; `X402_ENABLED=false` in local config |

### Part 5 — x402 XRPL/RLUSD Path
**Status: not testable locally**

Requires a live t54.ai facilitator. The server-side middleware is implemented but `X402_ENABLED=false` in `local-config.json` for local development. To test: stand up or point to a t54.ai-compatible facilitator and set `X402_ENABLED=true`.

### Part 6 — SDK and Plugins
**Status: complete**

| Component | Status | Notes |
|-----------|--------|-------|
| `XrplSigner` | ✅ demoed | `generate()`, `fromSeed()`, `signTransaction()` all exercised |
| `WalletService` | ✅ demoed | `xrplBalance`, `xrplTransactions` |
| `MarketplaceService` | ✅ demoed | `createListing`, `search`, `makeOffer`, `createEscrow`, `releaseEscrow`, `acceptOffer`, `confirmDelivery` |
| `EscrowMonitor` | ✅ demoed | `.check()` returns `PENDING` before broadcast |
| `McpTransport` | ✅ demoed | Streamable HTTP connection to `/mcp` endpoint |
| Claude plugin | ❌ not tested | Implemented; not exercised in this demo session |
| OpenClaw plugin | ❌ not tested | Implemented; not exercised in this demo session |

---

## Issues Encountered and Fixes Applied

### 1. Docker GCP credentials error
- **Symptom**: Server exited on startup with GCP ADC error
- **Cause**: `local-config.json` had `secret:mangrovemarkets-*` references for `ONEINCH_API_KEY`, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`
- **Fix**: Replace `secret:*` values with `""` in `MangroveMarkets-MCP-Server/src/shared/config/local-config.json`
- **Files**: `src/shared/config/local-config.json`

### 2. marketplace_search and marketplace_get_listing ignored X402_ENABLED=false
- **Symptom**: Search returned 402 payment required even with `X402_ENABLED=false` in config
- **Cause**: Both tools had hardcoded x402 gates that did not check the config flag
- **Fix**: Added `_get_x402_enabled()` check to both tools on `demo-branch` in MangroveMarkets-MCP-Server
- **Files**: `src/marketplace/tools.py`

### 3. McpTransport usage errors
- **Symptom**: Various `TypeError` / silent failures
- **Cause**: (a) Missing `await transport.connect()` before use; (b) Passing `{ url }` object instead of string to constructor
- **Fix**: `new McpTransport(SERVER_URL + '/mcp')` then `await transport.connect()`

### 4. marketplace_create_listing wrong param names
- **Symptom**: `price_xrp` missing error
- **Cause**: Script used `price` and `currency` — tool expects `price_xrpl` only
- **Fix**: Use `price_xrp` param via `MarketplaceService.createListing({ priceXrp })`

### 5. SELF_OFFER error on marketplace_make_offer
- **Symptom**: `SELF_OFFER` error code returned
- **Cause**: Buyer and seller were the same generated address
- **Fix**: Generate two separate wallets (`XrplSigner.generate()` called twice, seeds captured)

### 6. Script did not terminate
- **Symptom**: `node demo-part6.mjs` hung after completion
- **Cause**: MCP transport kept Node.js event loop alive
- **Fix**: `await transport.disconnect(); process.exit(0)` at end of script

### 7. DEX quotes fail on testnet
- **Symptom**: `dex_get_quote` returns `XRPL_RPC_DSTAMTMALFORMED` or similar for USDC/RLUSD pairs
- **Cause**: USDC and RLUSD issuer addresses are mainnet-only; testnet has no liquidity for these pairs
- **Fix**: Demo skips live DEX quotes; shows `dex_supported_venues` and `dex_supported_pairs` instead

### 8. EscrowCreate missing finish_after
- **Symptom**: `escrow_create` rejected — XRPL requires at least one time condition
- **Fix**: Added `finish_after: Math.floor(Date.now() / 1000) + 15` to `createEscrow` call

### 9. EscrowFinish tecNO_PERMISSION
- **Symptom**: EscrowFinish broadcast rejected by XRPL
- **Cause**: `finish_after` had not elapsed when EscrowFinish was submitted
- **Fix**: Shortened `finish_after` to `now + 15s`; extended Step 14 wait to 20s so finish_after elapses before Step 17

### 10. Python SDK XRPL keygen disabled (xrpl-py / httpx conflict)
- **Symptom**: `WalletService().create(chain="xrpl")` raised `NotImplementedError` in Python SDK 0.2.x
- **Cause**: `xrpl-py` pinned `httpx<0.25.0`; SDK required `httpx>=0.27.0`
- **Fix**: `xrpl-py` 4.x relaxed pin to `httpx>=0.18.1,<0.29.0` — conflict resolved. Added `xrpl-py>=4.0.0,<5.0` to `pyproject.toml`; implemented `_create_xrpl()` using `xrpl.wallet.Wallet.create()`
- **Branch**: `fix/python-sdk-xrpl-keygen`
- **Files**: `packages/python-sdk/pyproject.toml`, `packages/python-sdk/src/mangrovemarkets/_services/wallet.py`, `packages/python-sdk/tests/test_wallet.py`

---

## Architecture Notes for Agent

- **Non-custodial flow**: Server never sees private keys. `escrow_create` returns an unsigned tx; the client signs locally and broadcasts via `wallet_xrpl_broadcast`.
- **Escrow sequence**: `unsignedTx.payload.Sequence` is the on-chain escrow identifier. Pass it as `escrow_sequence` to `marketplace_accept_offer`.
- **marketplace_accept_offer** does live on-chain XRPL verification via `AccountObjects` RPC — must be called AFTER EscrowCreate is broadcast and confirmed (~4-8s on testnet).
- **confirm_delivery** returns `escrow_finish_params`; use them to call `escrow_release` → sign → broadcast EscrowFinish.
- **x402 / RLUSD path**: Requires a live t54.ai facilitator. Not testable locally; skipped in this demo. Controlled by `X402_ENABLED` in config.
- **XrplSigner.signTransaction()** returns a JSON string `'{"tx_blob":"...","tx_hash":"..."}'` — parse it before passing `tx_blob` to `wallet_xrpl_broadcast`.

---

## Next Steps

### High priority
- [ ] `marketplace_accept_offer`: test with real testnet escrow sequence end-to-end using `demo-part6.mjs`
- [ ] x402 / RLUSD path: stand up t54.ai facilitator locally or on staging; test `marketplace_search` with `X402_ENABLED=true`
- [ ] Python SDK: merge `fix/python-sdk-xrpl-keygen` branch and cut SDK 0.2.1 release

### Medium priority
- [ ] DEX quotes on testnet: either mock testnet liquidity or add a flag to `dex_get_quote` that short-circuits to a simulated quote for demo/test environments
- [ ] `EscrowMonitor`: extend to poll until `CONFIRMED` after broadcast (currently just does a one-shot `.check()`)
- [ ] `marketplace_rate`: implemented on server — not yet exercised in the demo script (add as Step 19)

### Low priority
- [ ] Solana wallet creation in Python SDK (`WalletService.create(chain="solana")`)
- [ ] Add `demo-part6.mjs` step for rating the completed transaction (Step 19)
- [ ] CI: add E2E test that spins up the Docker server and runs `demo-part6.mjs` headlessly

---

## How to Run the Demo

```bash
# 1. Start the MCP server
cd MangroveMarkets-MCP-Server
docker compose up

# 2. Build the TypeScript SDK
cd MangroveMarkets/packages/sdk
npm run build

# 3. Run the demo
node demo-part6.mjs
```

Expected runtime: ~45 seconds (dominated by faucet funding + 20s escrow wait).
