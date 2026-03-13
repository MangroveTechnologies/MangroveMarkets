# Claude + OpenClaw Plugins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build two platform plugins (Claude Code and OpenClaw) that expose MangroveMarkets capabilities through the @mangrove-ai/sdk.

**Architecture:** Both plugins are thin wrappers around the SDK. Claude Plugin provides skills (/swap, /marketplace, /wallet, /portfolio) and commands. OpenClaw Plugin provides tool definitions, dashboard components, and agent hooks. Neither plugin contains business logic.

**Tech Stack:** TypeScript 5+, pnpm workspaces, vitest, React 18 (OpenClaw dashboard), @mangrove-ai/sdk

**Design Doc:** `docs/plans/2026-02-28-plugins-design.md`

---

## Corrections from Stream E (2026-03-12)

The following corrections apply to the original design doc:

1. **SDK package name:** `@mangrove-ai/sdk` (not `@mangrove-one/mangrovemarkets`)
2. **Method renames:** `txStatus()` replaces `swapStatus()`, `supportedVenues()` replaces `supportedChains()`
3. **OpenClaw package path:** `packages/openclaw-plugin/` (not `packages/plugin/`)
4. **No marketplace/wallet SDK services:** The SDK only exports `DexService` and `OneInchService`. For marketplace and wallet operations, plugins call `transport.callTool()` directly (e.g., `transport.callTool('marketplace_search', {...})`, `transport.callTool('wallet_chain_info', {...})`).
5. **SDK exports:** `MangroveClient`, `DexService`, `EthersSigner`, `McpTransport`, `RestTransport`, plus types (`Quote`, `UnsignedTransaction`, `SwapResult`, `SwapParams`, etc.)
6. **MangroveClient.dex API:** `getQuote()`, `prepareSwap()`, `approveToken()`, `broadcast()`, `txStatus()`, `supportedVenues()`, `supportedPairs()`, `swap()` (requires Signer)

---

## Part A: Claude Plugin

### Task 1: Scaffold claude-plugin package

**Files:**
- Rewrite: `packages/claude-plugin/package.json`
- Create: `packages/claude-plugin/tsconfig.json`
- Create: `packages/claude-plugin/vitest.config.ts`

**Step 1:** Rewrite `packages/claude-plugin/package.json`:

```json
{
  "name": "@mangrove-ai/claude-plugin",
  "version": "0.1.0",
  "description": "Claude Code plugin for MangroveMarkets -- DEX, marketplace, wallet",
  "type": "module",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@mangrove-ai/sdk": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "tsup": "^8.0.0"
  },
  "peerDependencies": {
    "ethers": "^6.0.0"
  },
  "peerDependenciesMeta": {
    "ethers": { "optional": true }
  },
  "license": "MIT"
}
```

**Step 2:** Create `packages/claude-plugin/tsconfig.json` extending `../../tsconfig.base.json`.

**Step 3:** Create `packages/claude-plugin/vitest.config.ts` with globals, node environment, `src/**/*.test.ts` include.

**Step 4:** Commit: `chore(claude-plugin): scaffold package with tsconfig, vitest`

---

### Task 2: Plugin config and client initialization

**Files:**
- Create: `packages/claude-plugin/src/config.ts`
- Create: `packages/claude-plugin/src/index.ts`
- Test: `packages/claude-plugin/src/__tests__/config.test.ts`

Config loads from env vars:
- `MANGROVE_MCP_URL` (default: `http://localhost:8080`)
- `MANGROVE_TRANSPORT` (`mcp` | `rest`, default: `mcp`)
- `MANGROVE_API_KEY` (optional)

TDD: Write failing test first, then implement `loadConfig()`.

**Commit:** `feat(claude-plugin): add config loader with env-based MCP server URL and transport`

---

### Task 3: /swap skill handler

**Files:**
- Create: `packages/claude-plugin/src/skills/swap.ts`
- Test: `packages/claude-plugin/src/__tests__/swap.test.ts`

Handler accepts a `MangroveClient` and params with `action` discriminator:
- `action: 'quote'` -> calls `client.dex.getQuote({ src, dst, amount, chainId, mode })`
- `action: 'execute'` -> calls `client.dex.swap({ src, dst, amount, chainId, slippage, mevProtection, mode })`
- `action: 'status'` -> calls `client.dex.txStatus({ txHash, chainId })`

TDD: 4 tests (quote, execute, status, unknown action throws).

**Commit:** `feat(claude-plugin): add /swap skill handler with quote, execute, and status actions`

---

### Task 4: /marketplace skill handler

**Files:**
- Create: `packages/claude-plugin/src/skills/marketplace.ts`
- Test: `packages/claude-plugin/src/__tests__/marketplace.test.ts`

Since the SDK has no `MarketplaceService`, this handler uses `transport.callTool()` directly:
- `action: 'search'` -> `transport.callTool('marketplace_search', { query, category })`
- `action: 'get'` -> `transport.callTool('marketplace_get_listing', { listing_id })`
- `action: 'create'` -> `transport.callTool('marketplace_create_listing', { title, description, category, price, currency })`

Handler accepts `{ transport: Transport }` instead of full client.

TDD: 3 tests (search, get, create).

**Commit:** `feat(claude-plugin): add /marketplace skill handler using direct transport calls`

---

### Task 5: /wallet skill handler

**Files:**
- Create: `packages/claude-plugin/src/skills/wallet.ts`
- Test: `packages/claude-plugin/src/__tests__/wallet.test.ts`

Uses `transport.callTool()` directly:
- `action: 'info'` -> `transport.callTool('wallet_chain_info', { chain })`
- `action: 'create'` -> `transport.callTool('wallet_create', { chain, chain_id, network })`
- `action: 'balance'` -> `transport.callTool('wallet_balance', { address, chain_id })`

TDD: 3 tests.

**Commit:** `feat(claude-plugin): add /wallet skill handler using direct transport calls`

---

### Task 6: /portfolio skill handler

**Files:**
- Create: `packages/claude-plugin/src/skills/portfolio.ts`
- Test: `packages/claude-plugin/src/__tests__/portfolio.test.ts`

Uses SDK's OneInchService via transport:
- `action: 'value'` -> `transport.callTool('oneinch_portfolio_value', { addresses, chain_id })`
- `action: 'pnl'` -> `transport.callTool('oneinch_portfolio_pnl', { addresses, chain_id })`
- `action: 'balances'` -> `transport.callTool('oneinch_balances', { wallet, chain_id })`

TDD: 3 tests.

**Commit:** `feat(claude-plugin): add /portfolio skill handler`

---

### Task 7: /mangrove-status and /mangrove-connect commands

**Files:**
- Create: `packages/claude-plugin/src/commands/status.ts`
- Create: `packages/claude-plugin/src/commands/connect.ts`
- Test: `packages/claude-plugin/src/__tests__/commands.test.ts`

`handleStatus(config, isConnected)` returns `{ url, transport, connected, supportedChains }`.
`handleConnect(url, transport?)` returns `{ url, transport }`.

TDD: 4 tests.

**Commit:** `feat(claude-plugin): add /mangrove-status and /mangrove-connect commands`

---

## Part B: OpenClaw Plugin

### Task 8: Scaffold openclaw-plugin package

**Files:**
- Rewrite: `packages/openclaw-plugin/package.json`
- Create: `packages/openclaw-plugin/tsconfig.json`
- Create: `packages/openclaw-plugin/vitest.config.ts`
- Create: `packages/openclaw-plugin/openclaw.plugin.json`

Package.json deps: `@mangrove-ai/sdk: "workspace:*"`. Private, not published.
OpenClaw manifest includes tool definitions for DEX, marketplace, wallet, portfolio.

**Commit:** `chore(openclaw-plugin): scaffold package with manifest and config`

---

### Task 9: OpenClaw SDK client singleton

**Files:**
- Create: `packages/openclaw-plugin/src/lib/client.ts`
- Create: `packages/openclaw-plugin/src/lib/config.ts`
- Test: `packages/openclaw-plugin/src/__tests__/client.test.ts`

Singleton pattern: `getMangroveClient(config)` returns cached instance, `resetClient()` clears it.
Config interface: `{ url, apiKey?, transport? }`.

TDD: 2 tests (singleton, reset creates new).

**Commit:** `feat(openclaw-plugin): add SDK client singleton with config`

---

### Task 10: OpenClaw tool handlers

**Files:**
- Create: `packages/openclaw-plugin/src/tools/dex.ts`
- Create: `packages/openclaw-plugin/src/tools/marketplace.ts`
- Create: `packages/openclaw-plugin/src/tools/wallet.ts`
- Create: `packages/openclaw-plugin/src/tools/portfolio.ts`
- Test: `packages/openclaw-plugin/src/tools/__tests__/dex.test.ts`

Each module exports a factory function that takes a `MangroveClient` and returns a handler map:
- `dexToolHandlers(client)` -> `{ mangrove_dex_quote, mangrove_dex_swap, mangrove_dex_status }`
- `marketplaceToolHandlers(transport)` -> `{ mangrove_marketplace_search, ... }` (uses transport.callTool directly)
- `walletToolHandlers(transport)` -> `{ mangrove_wallet_info, mangrove_wallet_create, ... }`
- `portfolioToolHandlers(transport)` -> `{ mangrove_portfolio_value, ... }`

TDD: 3 tests for dex handlers.

**Commit:** `feat(openclaw-plugin): add tool handlers for DEX, marketplace, wallet, and portfolio`

---

### Task 11: OpenClaw agent hooks

**Files:**
- Create: `packages/openclaw-plugin/src/handlers/agentCall.ts`
- Create: `packages/openclaw-plugin/src/handlers/taskComplete.ts`
- Test: `packages/openclaw-plugin/src/__tests__/hooks.test.ts`

Simple logging hooks. `onAgentCall(event)` and `onTaskComplete(event)`.

TDD: 2 tests.

**Commit:** `feat(openclaw-plugin): add onAgentCall and onTaskComplete hook handlers`

---

### Task 12: OpenClaw dashboard component stubs

**Files:**
- Create: `packages/openclaw-plugin/src/components/MarketplaceBrowser.tsx`
- Create: `packages/openclaw-plugin/src/components/SwapWidget.tsx`
- Create: `packages/openclaw-plugin/src/components/WalletView.tsx`
- Create: `packages/openclaw-plugin/src/components/PortfolioView.tsx`

Placeholder React components with `data-testid` for future testing. No real functionality yet.

**Commit:** `feat(openclaw-plugin): add dashboard component stubs`

---

### Task 13: Full plugin test suite and CI

**Steps:**
1. Run all tests for both plugins: `pnpm --filter @mangrove-ai/claude-plugin test -- --run` and `pnpm --filter @mangrove-ai/openclaw-plugin test -- --run`
2. Update `.github/workflows/ci.yaml` to include both plugins in lint/test/build steps
3. Verify all tests pass

**Commit:** `ci(plugins): add claude-plugin and openclaw-plugin to CI workflow`

---

## Verification Checklist

- [ ] `pnpm --filter @mangrove-ai/sdk test -- --run` passes (54 tests)
- [ ] `pnpm --filter @mangrove-ai/claude-plugin test -- --run` passes (~18 tests)
- [ ] `pnpm --filter @mangrove-ai/openclaw-plugin test -- --run` passes (~8 tests)
- [ ] `pnpm --filter @mangrove-ai/claude-plugin build` succeeds
- [ ] `pnpm --filter @mangrove-ai/openclaw-plugin build` succeeds
- [ ] CI workflow includes all three packages
- [ ] No references to old SDK name `@mangrove-one/mangrovemarkets`
- [ ] No references to old method names `swapStatus()` or `supportedChains()`
- [ ] Marketplace and wallet handlers use `transport.callTool()`, not nonexistent SDK services
