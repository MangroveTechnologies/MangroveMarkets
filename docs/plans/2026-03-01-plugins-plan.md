# Claude + OpenClaw Plugins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build two platform plugins (Claude Code and OpenClaw) that expose MangroveMarkets capabilities through the @mangrove-one/mangrovemarkets SDK.

**Architecture:** Both plugins are thin wrappers around the SDK. Claude Plugin provides skills (/swap, /marketplace, /wallet, /portfolio) and commands. OpenClaw Plugin provides tool definitions, dashboard components, and agent hooks. Neither plugin contains business logic.

**Tech Stack:** TypeScript 5+, pnpm workspaces, vitest, React 18 (OpenClaw dashboard), @mangrove-one/mangrovemarkets SDK

**Design Doc:** `docs/plans/2026-02-28-plugins-design.md`

---

## Part A: Claude Plugin

### Task 1: Scaffold claude-plugin package

**Files:**
- Create: `packages/claude-plugin/package.json`
- Create: `packages/claude-plugin/tsconfig.json`
- Create: `packages/claude-plugin/vitest.config.ts`
- Create: `packages/claude-plugin/.claude-plugin/plugin.json`

**Step 1:** Create `packages/claude-plugin/package.json`:

```json
{
  "name": "@mangrove-one/claude-plugin",
  "version": "0.1.0",
  "description": "Claude Code plugin for MangroveMarkets -- DEX, marketplace, wallet",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@mangrove-one/mangrovemarkets": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "tsup": "^8.0.0"
  }
}
```

**Step 2:** Create `packages/claude-plugin/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 3:** Create `packages/claude-plugin/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

**Step 4:** Create `packages/claude-plugin/.claude-plugin/plugin.json`:

```json
{
  "name": "mangrove-markets",
  "version": "0.1.0",
  "description": "DEX aggregation, agent marketplace, and multi-chain wallet via MangroveMarkets",
  "skills": [
    {
      "name": "swap",
      "trigger": "/swap",
      "description": "Get quotes and swap tokens across DEX venues",
      "handler": "src/skills/swap.ts"
    },
    {
      "name": "marketplace",
      "trigger": "/marketplace",
      "description": "Browse, list, buy, and sell on the agent marketplace",
      "handler": "src/skills/marketplace.ts"
    },
    {
      "name": "wallet",
      "trigger": "/wallet",
      "description": "Create and manage multi-chain wallets",
      "handler": "src/skills/wallet.ts"
    },
    {
      "name": "portfolio",
      "trigger": "/portfolio",
      "description": "View balances, positions, and PnL across chains",
      "handler": "src/skills/portfolio.ts"
    }
  ],
  "commands": [
    {
      "name": "mangrove-status",
      "description": "Show MCP server connection status and active network"
    },
    {
      "name": "mangrove-connect",
      "description": "Connect to a MangroveMarkets MCP server"
    }
  ],
  "hooks": [],
  "agents": []
}
```

**Step 5:** Commit:

```bash
git add packages/claude-plugin/
git commit -m "chore(claude-plugin): scaffold package with plugin manifest, tsconfig, vitest"
```

---

### Task 2: Plugin config and client initialization

**Files:**
- Create: `packages/claude-plugin/src/config.ts`
- Create: `packages/claude-plugin/src/index.ts`
- Test: `packages/claude-plugin/src/__tests__/config.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/claude-plugin/src/__tests__/config.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../config';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads MCP server URL from env', () => {
    vi.stubEnv('MANGROVE_MCP_URL', 'https://api.mangrovemarkets.com');
    const config = loadConfig();
    expect(config.url).toBe('https://api.mangrovemarkets.com');
  });

  it('defaults to localhost', () => {
    const config = loadConfig();
    expect(config.url).toBe('http://localhost:8080');
  });

  it('loads transport preference', () => {
    vi.stubEnv('MANGROVE_TRANSPORT', 'rest');
    const config = loadConfig();
    expect(config.transport).toBe('rest');
  });

  it('defaults transport to mcp', () => {
    const config = loadConfig();
    expect(config.transport).toBe('mcp');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/config.test.ts`
Expected: FAIL -- module not found

**Step 3: Write implementation**

```typescript
// packages/claude-plugin/src/config.ts

export interface MangrovePluginConfig {
  url: string;
  transport: 'mcp' | 'rest';
  apiKey?: string;
}

export function loadConfig(): MangrovePluginConfig {
  return {
    url: process.env.MANGROVE_MCP_URL || 'http://localhost:8080',
    transport: (process.env.MANGROVE_TRANSPORT as 'mcp' | 'rest') || 'mcp',
    apiKey: process.env.MANGROVE_API_KEY,
  };
}
```

```typescript
// packages/claude-plugin/src/index.ts

export { loadConfig } from './config';
export type { MangrovePluginConfig } from './config';
```

**Step 4: Run test to verify it passes**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/config.test.ts`
Expected: PASS (4 tests)

**Step 5:** Commit:

```bash
git add packages/claude-plugin/src/config.ts packages/claude-plugin/src/index.ts packages/claude-plugin/src/__tests__/config.test.ts
git commit -m "feat(claude-plugin): add config loader with env-based MCP server URL and transport"
```

---

### Task 3: /swap skill handler

**Files:**
- Create: `packages/claude-plugin/src/skills/swap.ts`
- Test: `packages/claude-plugin/src/__tests__/swap.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/claude-plugin/src/__tests__/swap.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleSwap } from '../skills/swap';

const mockClient = {
  dex: {
    getQuote: vi.fn().mockResolvedValue({
      quoteId: 'q-123',
      venueId: '1inch',
      inputToken: 'USDC',
      outputToken: 'ETH',
      inputAmount: '1000000000',
      outputAmount: '500000000000000000',
      chainId: 8453,
    }),
    swap: vi.fn().mockResolvedValue({
      txHash: '0xabc',
      chainId: 8453,
      status: 'confirmed',
    }),
    swapStatus: vi.fn().mockResolvedValue({
      txHash: '0xabc',
      status: 'confirmed',
      blockNumber: 12345,
    }),
  },
};

describe('handleSwap', () => {
  it('gets a quote', async () => {
    const result = await handleSwap(mockClient as any, {
      action: 'quote',
      src: 'USDC',
      dst: 'ETH',
      amount: '1000000000',
      chainId: 8453,
    });
    expect(result.quoteId).toBe('q-123');
    expect(mockClient.dex.getQuote).toHaveBeenCalled();
  });

  it('executes a swap', async () => {
    const result = await handleSwap(mockClient as any, {
      action: 'execute',
      src: 'USDC',
      dst: 'ETH',
      amount: '1000000000',
      chainId: 8453,
      slippage: 0.5,
    });
    expect(result.txHash).toBe('0xabc');
    expect(mockClient.dex.swap).toHaveBeenCalled();
  });

  it('checks swap status', async () => {
    const result = await handleSwap(mockClient as any, {
      action: 'status',
      txHash: '0xabc',
      chainId: 8453,
    });
    expect(result.status).toBe('confirmed');
  });

  it('throws on unknown action', async () => {
    await expect(
      handleSwap(mockClient as any, { action: 'unknown' } as any)
    ).rejects.toThrow('Unknown swap action');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/swap.test.ts`
Expected: FAIL -- module not found

**Step 3: Write implementation**

```typescript
// packages/claude-plugin/src/skills/swap.ts

interface SwapQuoteParams {
  action: 'quote';
  src: string;
  dst: string;
  amount: string;
  chainId: number;
  mode?: 'standard' | 'x402';
}

interface SwapExecuteParams {
  action: 'execute';
  src: string;
  dst: string;
  amount: string;
  chainId: number;
  slippage?: number;
  mevProtection?: boolean;
  mode?: 'standard' | 'x402';
}

interface SwapStatusParams {
  action: 'status';
  txHash: string;
  chainId: number;
}

type SwapParams = SwapQuoteParams | SwapExecuteParams | SwapStatusParams;

export async function handleSwap(client: any, params: SwapParams): Promise<any> {
  switch (params.action) {
    case 'quote':
      return client.dex.getQuote({
        src: params.src,
        dst: params.dst,
        amount: params.amount,
        chainId: params.chainId,
        mode: params.mode,
      });

    case 'execute':
      return client.dex.swap({
        src: params.src,
        dst: params.dst,
        amount: params.amount,
        chainId: params.chainId,
        slippage: params.slippage ?? 0.5,
        mevProtection: params.mevProtection ?? false,
        mode: params.mode ?? 'standard',
      });

    case 'status':
      return client.dex.swapStatus({
        txHash: params.txHash,
        chainId: params.chainId,
      });

    default:
      throw new Error(`Unknown swap action: ${(params as any).action}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/swap.test.ts`
Expected: PASS (4 tests)

**Step 5:** Commit:

```bash
git add packages/claude-plugin/src/skills/swap.ts packages/claude-plugin/src/__tests__/swap.test.ts
git commit -m "feat(claude-plugin): add /swap skill handler with quote, execute, and status actions"
```

---

### Task 4: /marketplace skill handler

**Files:**
- Create: `packages/claude-plugin/src/skills/marketplace.ts`
- Test: `packages/claude-plugin/src/__tests__/marketplace.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/claude-plugin/src/__tests__/marketplace.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleMarketplace } from '../skills/marketplace';

const mockClient = {
  marketplace: {
    search: vi.fn().mockResolvedValue({ listings: [{ id: 'l-1', title: 'Test' }] }),
    getListing: vi.fn().mockResolvedValue({ id: 'l-1', title: 'Test', price: 10 }),
    createListing: vi.fn().mockResolvedValue({ id: 'l-2', title: 'New' }),
  },
};

describe('handleMarketplace', () => {
  it('searches listings', async () => {
    const result = await handleMarketplace(mockClient as any, {
      action: 'search',
      query: 'data',
    });
    expect(result.listings).toHaveLength(1);
  });

  it('gets a listing', async () => {
    const result = await handleMarketplace(mockClient as any, {
      action: 'get',
      listingId: 'l-1',
    });
    expect(result.id).toBe('l-1');
  });

  it('creates a listing', async () => {
    const result = await handleMarketplace(mockClient as any, {
      action: 'create',
      title: 'New Listing',
      description: 'A test listing',
      category: 'data',
      price: 5.0,
      currency: 'USDC',
    });
    expect(result.id).toBe('l-2');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/marketplace.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/claude-plugin/src/skills/marketplace.ts

interface SearchParams {
  action: 'search';
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

interface GetParams {
  action: 'get';
  listingId: string;
}

interface CreateParams {
  action: 'create';
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  tags?: string[];
}

type MarketplaceParams = SearchParams | GetParams | CreateParams;

export async function handleMarketplace(client: any, params: MarketplaceParams): Promise<any> {
  switch (params.action) {
    case 'search':
      return client.marketplace.search({
        query: params.query,
        category: params.category,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
      });

    case 'get':
      return client.marketplace.getListing(params.listingId);

    case 'create':
      return client.marketplace.createListing({
        title: params.title,
        description: params.description,
        category: params.category,
        price: params.price,
        currency: params.currency,
        tags: params.tags,
      });

    default:
      throw new Error(`Unknown marketplace action: ${(params as any).action}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/marketplace.test.ts`
Expected: PASS (3 tests)

**Step 5:** Commit:

```bash
git add packages/claude-plugin/src/skills/marketplace.ts packages/claude-plugin/src/__tests__/marketplace.test.ts
git commit -m "feat(claude-plugin): add /marketplace skill handler with search, get, and create actions"
```

---

### Task 5: /wallet skill handler

**Files:**
- Create: `packages/claude-plugin/src/skills/wallet.ts`
- Test: `packages/claude-plugin/src/__tests__/wallet.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/claude-plugin/src/__tests__/wallet.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleWallet } from '../skills/wallet';

const mockClient = {
  wallet: {
    create: vi.fn().mockResolvedValue({ address: '0xabc', chain: 'evm', chainId: 8453 }),
    balance: vi.fn().mockResolvedValue({ address: '0xabc', balances: [{ token: 'ETH', amount: '1.5' }] }),
    send: vi.fn().mockResolvedValue({ txHash: '0xdef', status: 'confirmed' }),
  },
};

describe('handleWallet', () => {
  it('creates a wallet', async () => {
    const result = await handleWallet(mockClient as any, {
      action: 'create',
      chain: 'evm',
      chainId: 8453,
    });
    expect(result.address).toBe('0xabc');
  });

  it('gets balance', async () => {
    const result = await handleWallet(mockClient as any, {
      action: 'balance',
      address: '0xabc',
      chainId: 8453,
    });
    expect(result.balances).toHaveLength(1);
  });

  it('sends tokens', async () => {
    const result = await handleWallet(mockClient as any, {
      action: 'send',
      from: '0xabc',
      to: '0xdef',
      amount: '1.0',
      token: 'ETH',
      chainId: 8453,
    });
    expect(result.txHash).toBe('0xdef');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/wallet.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/claude-plugin/src/skills/wallet.ts

interface CreateParams {
  action: 'create';
  chain: 'evm' | 'xrpl' | 'solana';
  chainId?: number;
  network?: string;
}

interface BalanceParams {
  action: 'balance';
  address: string;
  chainId?: number;
}

interface SendParams {
  action: 'send';
  from: string;
  to: string;
  amount: string;
  token: string;
  chainId?: number;
}

type WalletParams = CreateParams | BalanceParams | SendParams;

export async function handleWallet(client: any, params: WalletParams): Promise<any> {
  switch (params.action) {
    case 'create':
      return client.wallet.create({
        chain: params.chain,
        chainId: params.chainId,
        network: params.network,
      });

    case 'balance':
      return client.wallet.balance({
        address: params.address,
        chainId: params.chainId,
      });

    case 'send':
      return client.wallet.send({
        from: params.from,
        to: params.to,
        amount: params.amount,
        token: params.token,
        chainId: params.chainId,
      });

    default:
      throw new Error(`Unknown wallet action: ${(params as any).action}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/wallet.test.ts`
Expected: PASS (3 tests)

**Step 5:** Commit:

```bash
git add packages/claude-plugin/src/skills/wallet.ts packages/claude-plugin/src/__tests__/wallet.test.ts
git commit -m "feat(claude-plugin): add /wallet skill handler with create, balance, and send actions"
```

---

### Task 6: /portfolio skill handler

**Files:**
- Create: `packages/claude-plugin/src/skills/portfolio.ts`
- Test: `packages/claude-plugin/src/__tests__/portfolio.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/claude-plugin/src/__tests__/portfolio.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handlePortfolio } from '../skills/portfolio';

const mockClient = {
  oneinch: {
    getPortfolioValue: vi.fn().mockResolvedValue({ totalValueUsd: 10000, chains: {} }),
    getPortfolioPnl: vi.fn().mockResolvedValue({ totalPnlUsd: 500, period: '30d' }),
    getBalances: vi.fn().mockResolvedValue({ tokens: [{ symbol: 'ETH', balance: '1.5' }] }),
  },
};

describe('handlePortfolio', () => {
  it('gets portfolio value', async () => {
    const result = await handlePortfolio(mockClient as any, {
      action: 'value',
      addresses: ['0xabc'],
      chainId: 8453,
    });
    expect(result.totalValueUsd).toBe(10000);
  });

  it('gets PnL', async () => {
    const result = await handlePortfolio(mockClient as any, {
      action: 'pnl',
      addresses: ['0xabc'],
      chainId: 8453,
    });
    expect(result.totalPnlUsd).toBe(500);
  });

  it('gets balances', async () => {
    const result = await handlePortfolio(mockClient as any, {
      action: 'balances',
      wallet: '0xabc',
      chainId: 8453,
    });
    expect(result.tokens).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/portfolio.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/claude-plugin/src/skills/portfolio.ts

interface ValueParams {
  action: 'value';
  addresses: string[];
  chainId?: number;
}

interface PnlParams {
  action: 'pnl';
  addresses: string[];
  chainId?: number;
}

interface BalancesParams {
  action: 'balances';
  wallet: string;
  chainId: number;
}

type PortfolioParams = ValueParams | PnlParams | BalancesParams;

export async function handlePortfolio(client: any, params: PortfolioParams): Promise<any> {
  switch (params.action) {
    case 'value':
      return client.oneinch.getPortfolioValue({
        addresses: params.addresses,
        chainId: params.chainId,
      });

    case 'pnl':
      return client.oneinch.getPortfolioPnl({
        addresses: params.addresses,
        chainId: params.chainId,
      });

    case 'balances':
      return client.oneinch.getBalances({
        chainId: params.chainId,
        wallet: params.wallet,
      });

    default:
      throw new Error(`Unknown portfolio action: ${(params as any).action}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/portfolio.test.ts`
Expected: PASS (3 tests)

**Step 5:** Commit:

```bash
git add packages/claude-plugin/src/skills/portfolio.ts packages/claude-plugin/src/__tests__/portfolio.test.ts
git commit -m "feat(claude-plugin): add /portfolio skill handler with value, pnl, and balances actions"
```

---

### Task 7: /mangrove-status and /mangrove-connect commands

**Files:**
- Create: `packages/claude-plugin/src/commands/status.ts`
- Create: `packages/claude-plugin/src/commands/connect.ts`
- Test: `packages/claude-plugin/src/__tests__/commands.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/claude-plugin/src/__tests__/commands.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleStatus } from '../commands/status';
import { handleConnect } from '../commands/connect';

describe('handleStatus', () => {
  it('returns connection info', () => {
    const config = { url: 'https://api.mangrovemarkets.com', transport: 'mcp' as const };
    const result = handleStatus(config, true);
    expect(result.url).toBe('https://api.mangrovemarkets.com');
    expect(result.connected).toBe(true);
    expect(result.transport).toBe('mcp');
  });

  it('shows disconnected state', () => {
    const config = { url: 'http://localhost:8080', transport: 'mcp' as const };
    const result = handleStatus(config, false);
    expect(result.connected).toBe(false);
  });
});

describe('handleConnect', () => {
  it('returns connection config', () => {
    const result = handleConnect('https://api.mangrovemarkets.com', 'mcp');
    expect(result.url).toBe('https://api.mangrovemarkets.com');
    expect(result.transport).toBe('mcp');
  });

  it('defaults transport to mcp', () => {
    const result = handleConnect('https://api.mangrovemarkets.com');
    expect(result.transport).toBe('mcp');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/commands.test.ts`
Expected: FAIL

**Step 3: Write implementations**

```typescript
// packages/claude-plugin/src/commands/status.ts

import type { MangrovePluginConfig } from '../config';

export interface StatusResult {
  url: string;
  transport: string;
  connected: boolean;
  supportedChains: string[];
}

export function handleStatus(config: MangrovePluginConfig, isConnected: boolean): StatusResult {
  return {
    url: config.url,
    transport: config.transport,
    connected: isConnected,
    supportedChains: ['evm', 'xrpl', 'solana'],
  };
}
```

```typescript
// packages/claude-plugin/src/commands/connect.ts

export interface ConnectResult {
  url: string;
  transport: 'mcp' | 'rest';
}

export function handleConnect(url: string, transport?: 'mcp' | 'rest'): ConnectResult {
  return {
    url,
    transport: transport ?? 'mcp',
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/claude-plugin && npx vitest run src/__tests__/commands.test.ts`
Expected: PASS (4 tests)

**Step 5:** Commit:

```bash
git add packages/claude-plugin/src/commands/ packages/claude-plugin/src/__tests__/commands.test.ts
git commit -m "feat(claude-plugin): add /mangrove-status and /mangrove-connect commands"
```

---

## Part B: OpenClaw Plugin

### Task 8: Update OpenClaw manifest

**Files:**
- Modify: `packages/plugin/openclaw.plugin.json`

**Step 1:** Read the existing manifest and add tool definitions for DEX, marketplace, wallet, and portfolio.

Add to `openclaw.plugin.json` under the tools section:

```json
{
  "tools": [
    {
      "name": "mangrove_dex_quote",
      "description": "Get a swap quote from the best available DEX venue",
      "parameters": {
        "src": { "type": "string", "description": "Source token address or symbol" },
        "dst": { "type": "string", "description": "Destination token address or symbol" },
        "amount": { "type": "string", "description": "Amount in smallest unit" },
        "chainId": { "type": "number", "description": "EVM chain ID" }
      }
    },
    {
      "name": "mangrove_dex_swap",
      "description": "Execute a token swap with local signing",
      "parameters": {
        "src": { "type": "string" },
        "dst": { "type": "string" },
        "amount": { "type": "string" },
        "chainId": { "type": "number" },
        "slippage": { "type": "number", "default": 0.5 }
      }
    },
    {
      "name": "mangrove_marketplace_search",
      "description": "Search marketplace listings",
      "parameters": {
        "query": { "type": "string" },
        "category": { "type": "string" }
      }
    },
    {
      "name": "mangrove_wallet_create",
      "description": "Create a new wallet",
      "parameters": {
        "chain": { "type": "string", "enum": ["evm", "xrpl", "solana"] },
        "chainId": { "type": "number" }
      }
    }
  ]
}
```

**Step 2:** Commit:

```bash
git add packages/plugin/openclaw.plugin.json
git commit -m "feat(openclaw-plugin): add DEX, marketplace, and wallet tool definitions to manifest"
```

---

### Task 9: OpenClaw SDK client singleton

**Files:**
- Create: `packages/plugin/lib/client.ts`
- Create: `packages/plugin/lib/config.ts`
- Test: `packages/plugin/lib/__tests__/client.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/plugin/lib/__tests__/client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getMangroveClient, resetClient } from '../client';

vi.mock('@mangrove-one/mangrovemarkets', () => ({
  MangroveClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

describe('getMangroveClient', () => {
  it('returns a singleton instance', () => {
    resetClient();
    const a = getMangroveClient({ url: 'http://localhost:8080' });
    const b = getMangroveClient({ url: 'http://localhost:8080' });
    expect(a).toBe(b);
  });

  it('creates a new instance after reset', () => {
    const a = getMangroveClient({ url: 'http://localhost:8080' });
    resetClient();
    const b = getMangroveClient({ url: 'http://localhost:8080' });
    expect(a).not.toBe(b);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/plugin && npx vitest run lib/__tests__/client.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/plugin/lib/config.ts

export interface OpenClawMangroveConfig {
  url: string;
  apiKey?: string;
  transport?: 'mcp' | 'rest';
}
```

```typescript
// packages/plugin/lib/client.ts

import type { OpenClawMangroveConfig } from './config';

let _instance: any = null;

export function getMangroveClient(config: OpenClawMangroveConfig): any {
  if (!_instance) {
    // Dynamic import to avoid circular deps at module load time
    const { MangroveClient } = require('@mangrove-one/mangrovemarkets');
    _instance = new MangroveClient({
      url: config.url,
      transport: config.transport ?? 'mcp',
      apiKey: config.apiKey,
    });
  }
  return _instance;
}

export function resetClient(): void {
  _instance = null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/plugin && npx vitest run lib/__tests__/client.test.ts`
Expected: PASS (2 tests)

**Step 5:** Commit:

```bash
git add packages/plugin/lib/
git commit -m "feat(openclaw-plugin): add SDK client singleton with config"
```

---

### Task 10: OpenClaw tool handlers

**Files:**
- Create: `packages/plugin/tools/dex.ts`
- Create: `packages/plugin/tools/marketplace.ts`
- Create: `packages/plugin/tools/wallet.ts`
- Create: `packages/plugin/tools/portfolio.ts`
- Test: `packages/plugin/tools/__tests__/dex.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/plugin/tools/__tests__/dex.test.ts
import { describe, it, expect, vi } from 'vitest';
import { dexToolHandlers } from '../dex';

const mockClient = {
  dex: {
    getQuote: vi.fn().mockResolvedValue({ quoteId: 'q-1' }),
    swap: vi.fn().mockResolvedValue({ txHash: '0xabc' }),
    swapStatus: vi.fn().mockResolvedValue({ status: 'confirmed' }),
  },
};

describe('dexToolHandlers', () => {
  const handlers = dexToolHandlers(mockClient as any);

  it('has quote handler', async () => {
    const result = await handlers.mangrove_dex_quote({
      src: 'USDC', dst: 'ETH', amount: '1000', chainId: 8453,
    });
    expect(result.quoteId).toBe('q-1');
  });

  it('has swap handler', async () => {
    const result = await handlers.mangrove_dex_swap({
      src: 'USDC', dst: 'ETH', amount: '1000', chainId: 8453, slippage: 0.5,
    });
    expect(result.txHash).toBe('0xabc');
  });

  it('has status handler', async () => {
    const result = await handlers.mangrove_dex_status({
      txHash: '0xabc', chainId: 8453,
    });
    expect(result.status).toBe('confirmed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/plugin && npx vitest run tools/__tests__/dex.test.ts`
Expected: FAIL

**Step 3: Write implementations**

```typescript
// packages/plugin/tools/dex.ts

export function dexToolHandlers(client: any) {
  return {
    mangrove_dex_quote: async (params: any) => client.dex.getQuote(params),
    mangrove_dex_swap: async (params: any) => client.dex.swap(params),
    mangrove_dex_status: async (params: any) => client.dex.swapStatus(params),
  };
}
```

```typescript
// packages/plugin/tools/marketplace.ts

export function marketplaceToolHandlers(client: any) {
  return {
    mangrove_marketplace_search: async (params: any) => client.marketplace.search(params),
    mangrove_marketplace_get: async (params: any) => client.marketplace.getListing(params.listingId),
    mangrove_marketplace_create: async (params: any) => client.marketplace.createListing(params),
  };
}
```

```typescript
// packages/plugin/tools/wallet.ts

export function walletToolHandlers(client: any) {
  return {
    mangrove_wallet_create: async (params: any) => client.wallet.create(params),
    mangrove_wallet_balance: async (params: any) => client.wallet.balance(params),
    mangrove_wallet_send: async (params: any) => client.wallet.send(params),
  };
}
```

```typescript
// packages/plugin/tools/portfolio.ts

export function portfolioToolHandlers(client: any) {
  return {
    mangrove_portfolio_value: async (params: any) => client.oneinch.getPortfolioValue(params),
    mangrove_portfolio_pnl: async (params: any) => client.oneinch.getPortfolioPnl(params),
    mangrove_portfolio_balances: async (params: any) => client.oneinch.getBalances(params),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/plugin && npx vitest run tools/__tests__/dex.test.ts`
Expected: PASS (3 tests)

**Step 5:** Commit:

```bash
git add packages/plugin/tools/
git commit -m "feat(openclaw-plugin): add tool handlers for DEX, marketplace, wallet, and portfolio"
```

---

### Task 11: OpenClaw agent hooks

**Files:**
- Create: `packages/plugin/handlers/agentCall.ts`
- Create: `packages/plugin/handlers/taskComplete.ts`
- Test: `packages/plugin/handlers/__tests__/hooks.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/plugin/handlers/__tests__/hooks.test.ts
import { describe, it, expect, vi } from 'vitest';
import { onAgentCall } from '../agentCall';
import { onTaskComplete } from '../taskComplete';

describe('onAgentCall', () => {
  it('logs the agent call event', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await onAgentCall({ agentId: 'agent-1', toolName: 'mangrove_dex_quote', timestamp: Date.now() });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('agent-1'));
    consoleSpy.mockRestore();
  });
});

describe('onTaskComplete', () => {
  it('logs the task completion event', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await onTaskComplete({ taskId: 'task-1', result: 'success', timestamp: Date.now() });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('task-1'));
    consoleSpy.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/plugin && npx vitest run handlers/__tests__/hooks.test.ts`
Expected: FAIL

**Step 3: Write implementations**

```typescript
// packages/plugin/handlers/agentCall.ts

interface AgentCallEvent {
  agentId: string;
  toolName: string;
  timestamp: number;
}

export async function onAgentCall(event: AgentCallEvent): Promise<void> {
  console.log(`[MangroveMarkets] Agent ${event.agentId} called ${event.toolName}`);
}
```

```typescript
// packages/plugin/handlers/taskComplete.ts

interface TaskCompleteEvent {
  taskId: string;
  result: string;
  timestamp: number;
}

export async function onTaskComplete(event: TaskCompleteEvent): Promise<void> {
  console.log(`[MangroveMarkets] Task ${event.taskId} completed: ${event.result}`);
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/plugin && npx vitest run handlers/__tests__/hooks.test.ts`
Expected: PASS (2 tests)

**Step 5:** Commit:

```bash
git add packages/plugin/handlers/
git commit -m "feat(openclaw-plugin): add onAgentCall and onTaskComplete hook handlers"
```

---

### Task 12: OpenClaw dashboard components (stubs)

**Files:**
- Create: `packages/plugin/components/MarketplaceBrowser.tsx`
- Create: `packages/plugin/components/SwapWidget.tsx`
- Create: `packages/plugin/components/WalletView.tsx`
- Create: `packages/plugin/components/PortfolioView.tsx`

**Step 1:** Create stub React components that render a placeholder with a data-testid.

```tsx
// packages/plugin/components/MarketplaceBrowser.tsx
import React from 'react';

export function MarketplaceBrowser() {
  return <div data-testid="marketplace-browser">Marketplace Browser (loading...)</div>;
}
```

```tsx
// packages/plugin/components/SwapWidget.tsx
import React from 'react';

export function SwapWidget() {
  return <div data-testid="swap-widget">Swap Widget (loading...)</div>;
}
```

```tsx
// packages/plugin/components/WalletView.tsx
import React from 'react';

export function WalletView() {
  return <div data-testid="wallet-view">Wallet View (loading...)</div>;
}
```

```tsx
// packages/plugin/components/PortfolioView.tsx
import React from 'react';

export function PortfolioView() {
  return <div data-testid="portfolio-view">Portfolio View (loading...)</div>;
}
```

**Step 2:** Commit:

```bash
git add packages/plugin/components/
git commit -m "feat(openclaw-plugin): add dashboard component stubs for marketplace, swap, wallet, portfolio"
```

---

### Task 13: Full plugin test suite

**Files:**
- Test: `packages/claude-plugin/src/__tests__/all.test.ts`
- Test: `packages/plugin/tools/__tests__/all.test.ts`

**Step 1:** Run all tests for both plugins.

```bash
cd packages/claude-plugin && npx vitest run
cd packages/plugin && npx vitest run
```

Expected: All tests pass across both plugins.

**Step 2:** Commit:

```bash
git commit --allow-empty -m "test(plugins): verify full test suite passes for Claude and OpenClaw plugins"
```
