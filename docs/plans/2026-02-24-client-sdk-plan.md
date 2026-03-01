# Client SDK Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the @mangrove-one/mangrovemarkets TypeScript SDK with pluggable signing, MCP+REST transports, and high-level swap orchestration.

**Architecture:** Domain-scoped SDK wrapping MCP server tools. Transport layer abstracts MCP vs REST. Signer interface ensures private keys never leave the client. DexService provides low-level API, SwapOrchestrator handles the full approve→prepare→sign→broadcast→poll flow.

**Tech Stack:** TypeScript 5+, pnpm workspaces, vitest, @modelcontextprotocol/sdk, ethers.js (optional peer dep)

---

## Phase 1: Core + DEX

### Task 1: Monorepo scaffold

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/package.json` (root)
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/pnpm-workspace.yaml`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/tsconfig.base.json`

No tests needed — config only.

**Step 1:** Create root `package.json`:
```json
{
  "name": "mangrove-markets-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "engines": { "node": ">=18", "pnpm": ">=8" }
}
```

**Step 2:** Create `pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

**Step 3:** Create `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "bundler",
    "lib": ["ES2020"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

**Step 4:** Commit:
```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json
git commit -m "chore: scaffold pnpm monorepo workspace"
```

---

### Task 2: SDK package configuration

**Files:**
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/package.json`
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/tsconfig.json`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/vitest.config.ts`

No tests needed — config only.

**Step 1:** Rewrite `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/package.json`:
```json
{
  "name": "@mangrove-one/mangrovemarkets",
  "version": "0.1.0",
  "description": "TypeScript SDK for Mangrove Markets — DEX aggregation with pluggable signing",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "test": "vitest",
    "lint": "tsc --noEmit"
  },
  "keywords": ["mangrove", "dex", "agent", "mcp", "crypto", "swap", "1inch"],
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "peerDependencies": {
    "ethers": "^6.0.0"
  },
  "peerDependenciesMeta": {
    "ethers": { "optional": true }
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "tsup": "^8.0.0",
    "ethers": "^6.0.0"
  }
}
```

**Step 2:** Rewrite `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/__tests__/**"]
}
```

**Step 3:** Create `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/*.test.ts'],
  },
});
```

**Step 4:** Install deps:
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm install
```

**Step 5:** Commit:
```bash
git add packages/sdk/package.json packages/sdk/tsconfig.json packages/sdk/vitest.config.ts
git commit -m "chore(sdk): configure package for ESM+CJS dual build with vitest"
```

---

### Task 3: Core types

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/dex.ts`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/transport.ts`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/signer.ts`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/config.ts`
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/index.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/__tests__/types.test.ts`

**Step 1: Write the failing test**

```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  Quote,
  UnsignedTransaction,
  BroadcastResult,
  TransactionStatus,
  SwapResult,
  SwapParams,
  QuoteParams,
  ApproveParams,
  BroadcastParams,
  BillingMode,
  Transport,
  Signer,
  MangroveConfig,
} from '../../types';

describe('DEX types', () => {
  it('Quote has required fields', () => {
    const quote: Quote = {
      quoteId: 'q-123',
      venueId: '1inch',
      inputToken: '0xA0b8...',
      outputToken: '0xEeee...',
      inputAmount: '1000000000',
      outputAmount: '500000000000000000',
      mangroveFee: '0.25',
      chainId: 8453,
      billingMode: 'standard',
      routes: ['1inch-classic'],
      expiresAt: '2026-02-24T12:00:00Z',
    };
    expect(quote.quoteId).toBe('q-123');
    expect(quote.billingMode).toBe('standard');
  });

  it('UnsignedTransaction has EVM calldata fields', () => {
    const tx: UnsignedTransaction = {
      chainId: 8453,
      to: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      data: '0x12aa3caf...',
      value: '0',
      gas: '200000',
    };
    expect(tx.chainId).toBe(8453);
    expect(tx.to).toMatch(/^0x/);
  });

  it('SwapParams accepts all swap config', () => {
    const params: SwapParams = {
      src: '0xA0b8...',
      dst: '0xEeee...',
      amount: '1000000000',
      chainId: 8453,
      slippage: 0.5,
      mevProtection: true,
      mode: 'standard',
    };
    expect(params.slippage).toBe(0.5);
  });

  it('BillingMode is standard or x402', () => {
    const standard: BillingMode = 'standard';
    const x402: BillingMode = 'x402';
    expect(standard).toBe('standard');
    expect(x402).toBe('x402');
  });
});

describe('Transport interface', () => {
  it('Transport defines callTool, connect, disconnect', () => {
    const mock: Transport = {
      callTool: async () => ({}),
      connect: async () => {},
      disconnect: async () => {},
    };
    expect(mock.callTool).toBeDefined();
    expect(mock.connect).toBeDefined();
    expect(mock.disconnect).toBeDefined();
  });
});

describe('Signer interface', () => {
  it('Signer defines getAddress, signTransaction, getSupportedChainIds', () => {
    const mock: Signer = {
      getAddress: async () => '0xabc123',
      signTransaction: async () => '0xsigned',
      getSupportedChainIds: async () => [1, 8453],
    };
    expect(mock.getAddress).toBeDefined();
  });
});

describe('MangroveConfig', () => {
  it('accepts url, signer, transport, apiKey', () => {
    const config: MangroveConfig = {
      url: 'https://api.mangrovemarkets.com',
      transport: 'mcp',
    };
    expect(config.url).toBe('https://api.mangrovemarkets.com');
    expect(config.transport).toBe('mcp');
  });
});
```

**Step 2: Run test to verify it fails**
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run src/types/__tests__/types.test.ts
```
Expected: FAIL — types not exported

**Step 3: Write the implementations**

`/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/dex.ts`:
```typescript
export type BillingMode = 'standard' | 'x402';

export interface Quote {
  quoteId: string;
  venueId: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  mangroveFee: string;
  chainId: number;
  billingMode: BillingMode;
  routes: string[];
  expiresAt: string;
}

export interface UnsignedTransaction {
  chainId: number;
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface BroadcastResult {
  txHash: string;
  chainId: number;
  broadcastMethod: string;
}

export interface TransactionStatus {
  txHash: string;
  chainId: number;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
}

export interface SwapResult {
  txHash: string;
  chainId: number;
  status: 'confirmed' | 'failed';
  gasUsed: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
}

export interface QuoteParams {
  src: string;
  dst: string;
  amount: string;
  chainId: number;
  mode?: BillingMode;
}

export interface SwapParams {
  src: string;
  dst: string;
  amount: string;
  chainId: number;
  slippage?: number;
  mevProtection?: boolean;
  mode?: BillingMode;
}

export interface ApproveParams {
  tokenAddress: string;
  chainId: number;
  amount?: string;
}

export interface BroadcastParams {
  chainId: number;
  signedTx: string;
  mevProtection?: boolean;
}

export interface SwapStatusParams {
  txHash: string;
  chainId: number;
}
```

`/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/transport.ts`:
```typescript
export interface ToolCallResult {
  [key: string]: unknown;
}

export interface Transport {
  callTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
```

`/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/signer.ts`:
```typescript
import type { UnsignedTransaction } from './dex';

export interface Signer {
  getAddress(): Promise<string>;
  signTransaction(tx: UnsignedTransaction): Promise<string>;
  getSupportedChainIds(): Promise<number[]>;
}
```

`/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/config.ts`:
```typescript
import type { Signer } from './signer';

export interface MangroveConfig {
  url: string;
  signer?: Signer;
  transport?: 'mcp' | 'rest';
  apiKey?: string;
}
```

`/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/index.ts`:
```typescript
export * from './dex';
export * from './transport';
export * from './signer';
export * from './config';
```

**Step 4: Run test to verify it passes**
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run src/types/__tests__/types.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add packages/sdk/src/types/
git commit -m "feat(sdk): add core types for DEX, Transport, Signer, Config"
```

---

### Task 4: Signer interface re-export

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/signer/interface.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/signer/__tests__/interface.test.ts`

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/signer/__tests__/interface.test.ts
import { describe, it, expect } from 'vitest';
import type { Signer } from '../interface';
import type { UnsignedTransaction } from '../../types';

describe('Signer interface', () => {
  it('mock signer returns address', async () => {
    const signer: Signer = {
      getAddress: async () => '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      signTransaction: async (tx: UnsignedTransaction) => '0xsigned_' + tx.data.slice(0, 10),
      getSupportedChainIds: async () => [1, 8453, 42161],
    };
    expect(await signer.getAddress()).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18');
    expect(await signer.getSupportedChainIds()).toContain(8453);
  });

  it('signTransaction receives UnsignedTransaction and returns hex string', async () => {
    const signer: Signer = {
      getAddress: async () => '0xabc',
      signTransaction: async (tx: UnsignedTransaction) => {
        expect(tx.chainId).toBe(1);
        expect(tx.to).toMatch(/^0x/);
        return '0xdeadbeef';
      },
      getSupportedChainIds: async () => [1],
    };
    const result = await signer.signTransaction({
      chainId: 1,
      to: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      data: '0x12aa3caf',
      value: '0',
      gas: '200000',
    });
    expect(result).toBe('0xdeadbeef');
  });
});
```

**Step 2: Run test to verify it fails**
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run src/signer/__tests__/interface.test.ts
```
Expected: FAIL — module not found

**Step 3: Write minimal implementation**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/signer/interface.ts
export type { Signer } from '../types/signer';
```

**Step 4: Run test to verify it passes**
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run src/signer/__tests__/interface.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add packages/sdk/src/signer/
git commit -m "feat(sdk): add Signer interface re-export"
```

---

### Task 5: EthersSigner adapter

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/signer/ethers.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/signer/__tests__/ethers.test.ts`

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/signer/__tests__/ethers.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EthersSigner } from '../ethers';
import type { UnsignedTransaction } from '../../types';

// Mock ethers Wallet
const mockWallet = {
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
  signTransaction: vi.fn().mockResolvedValue('0xsigned_transaction_hex'),
};

describe('EthersSigner', () => {
  it('getAddress returns wallet address', async () => {
    const signer = new EthersSigner(mockWallet as any, [1, 8453]);
    expect(await signer.getAddress()).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18');
  });

  it('signTransaction delegates to ethers wallet', async () => {
    const signer = new EthersSigner(mockWallet as any, [1, 8453]);
    const tx: UnsignedTransaction = {
      chainId: 1,
      to: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      data: '0x12aa3caf',
      value: '0',
      gas: '200000',
    };
    const signed = await signer.signTransaction(tx);
    expect(signed).toBe('0xsigned_transaction_hex');
    expect(mockWallet.signTransaction).toHaveBeenCalledWith({
      chainId: 1,
      to: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      data: '0x12aa3caf',
      value: '0',
      gasLimit: '200000',
    });
  });

  it('getSupportedChainIds returns configured chains', async () => {
    const signer = new EthersSigner(mockWallet as any, [1, 8453, 42161]);
    expect(await signer.getSupportedChainIds()).toEqual([1, 8453, 42161]);
  });
});
```

**Step 2: Run test to verify it fails**
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run src/signer/__tests__/ethers.test.ts
```
Expected: FAIL — EthersSigner not found

**Step 3: Write minimal implementation**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/signer/ethers.ts
import type { Signer } from '../types/signer';
import type { UnsignedTransaction } from '../types/dex';

interface EthersWallet {
  address: string;
  signTransaction(tx: Record<string, unknown>): Promise<string>;
}

export class EthersSigner implements Signer {
  private wallet: EthersWallet;
  private chainIds: number[];

  constructor(wallet: EthersWallet, supportedChainIds: number[]) {
    this.wallet = wallet;
    this.chainIds = supportedChainIds;
  }

  async getAddress(): Promise<string> {
    return this.wallet.address;
  }

  async signTransaction(tx: UnsignedTransaction): Promise<string> {
    return this.wallet.signTransaction({
      chainId: tx.chainId,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gasLimit: tx.gas,
      ...(tx.gasPrice ? { gasPrice: tx.gasPrice } : {}),
      ...(tx.maxFeePerGas ? { maxFeePerGas: tx.maxFeePerGas } : {}),
      ...(tx.maxPriorityFeePerGas ? { maxPriorityFeePerGas: tx.maxPriorityFeePerGas } : {}),
    });
  }

  async getSupportedChainIds(): Promise<number[]> {
    return this.chainIds;
  }
}
```

**Step 4: Run test to verify it passes**
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run src/signer/__tests__/ethers.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add packages/sdk/src/signer/ethers.ts packages/sdk/src/signer/__tests__/ethers.test.ts
git commit -m "feat(sdk): add EthersSigner adapter for ethers.js wallets"
```

---

### Task 6: Transport interface + MockTransport

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/interface.ts`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/__tests__/mock.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/__tests__/interface.test.ts`

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/__tests__/interface.test.ts
import { describe, it, expect } from 'vitest';
import { MockTransport } from './mock';

describe('MockTransport', () => {
  it('records tool calls and returns configured responses', async () => {
    const mock = new MockTransport();
    mock.addResponse('dex_get_quote', { quoteId: 'q-1', inputAmount: '1000' });

    const result = await mock.callTool('dex_get_quote', { src: '0xa', dst: '0xb', amount: '1000', chain_id: 1 });

    expect(result).toEqual({ quoteId: 'q-1', inputAmount: '1000' });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].name).toBe('dex_get_quote');
    expect(mock.calls[0].params.src).toBe('0xa');
  });

  it('connect and disconnect are no-ops', async () => {
    const mock = new MockTransport();
    await expect(mock.connect()).resolves.toBeUndefined();
    await expect(mock.disconnect()).resolves.toBeUndefined();
  });

  it('throws if no response configured for tool', async () => {
    const mock = new MockTransport();
    await expect(mock.callTool('unknown_tool', {})).rejects.toThrow('No mock response for tool: unknown_tool');
  });

  it('supports sequential responses', async () => {
    const mock = new MockTransport();
    mock.addResponse('dex_swap_status', { status: 'pending' });
    mock.addResponse('dex_swap_status', { status: 'confirmed' });

    const r1 = await mock.callTool('dex_swap_status', { tx_hash: '0x1', chain_id: 1 });
    const r2 = await mock.callTool('dex_swap_status', { tx_hash: '0x1', chain_id: 1 });
    expect(r1).toEqual({ status: 'pending' });
    expect(r2).toEqual({ status: 'confirmed' });
  });
});
```

**Step 2: Run test to verify it fails**
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run src/transport/__tests__/interface.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**

`/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/interface.ts`:
```typescript
export type { Transport, ToolCallResult } from '../types/transport';
```

`/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/__tests__/mock.ts`:
```typescript
import type { Transport, ToolCallResult } from '../../types/transport';

interface ToolCall {
  name: string;
  params: Record<string, unknown>;
}

export class MockTransport implements Transport {
  calls: ToolCall[] = [];
  private responses: Map<string, ToolCallResult[]> = new Map();

  addResponse(toolName: string, response: ToolCallResult): void {
    const existing = this.responses.get(toolName) || [];
    existing.push(response);
    this.responses.set(toolName, existing);
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    this.calls.push({ name, params });
    const queue = this.responses.get(name);
    if (!queue || queue.length === 0) {
      throw new Error(`No mock response for tool: ${name}`);
    }
    // If only one response, keep returning it; otherwise shift
    return queue.length === 1 ? queue[0] : queue.shift()!;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
```

**Step 4: Run test to verify it passes**
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run src/transport/__tests__/interface.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add packages/sdk/src/transport/
git commit -m "feat(sdk): add Transport interface re-export and MockTransport for testing"
```

---

### Task 7: MCP transport

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/mcp.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/__tests__/mcp.test.ts`

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/__tests__/mcp.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpTransport } from '../mcp';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ quoteId: 'q-1' }) }],
    }),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({})),
}));

describe('McpTransport', () => {
  let transport: McpTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new McpTransport('https://api.mangrovemarkets.com/mcp');
  });

  it('connect creates MCP client and connects', async () => {
    await transport.connect();
    // Should not throw
  });

  it('callTool sends tool call and parses JSON response', async () => {
    await transport.connect();
    const result = await transport.callTool('dex_get_quote', { src: '0xa', dst: '0xb' });
    expect(result).toEqual({ quoteId: 'q-1' });
  });

  it('callTool throws if not connected', async () => {
    await expect(transport.callTool('dex_get_quote', {})).rejects.toThrow('Not connected');
  });

  it('disconnect closes the client', async () => {
    await transport.connect();
    await transport.disconnect();
  });
});
```

**Step 2: Run test to verify it fails**
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run src/transport/__tests__/mcp.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/mcp.ts
import type { Transport, ToolCallResult } from '../types/transport';

export class McpTransport implements Transport {
  private url: string;
  private apiKey?: string;
  private client: any = null;

  constructor(url: string, apiKey?: string) {
    this.url = url;
    this.apiKey = apiKey;
  }

  async connect(): Promise<void> {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/streamableHttp.js'
    );

    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const mcpTransport = new StreamableHTTPClientTransport(
      new URL(this.url),
      { requestInit: { headers } },
    );

    this.client = new Client({ name: 'mangrove-sdk', version: '0.1.0' });
    await this.client.connect(mcpTransport);
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }
    const result = await this.client.callTool({ name, arguments: params });
    const textContent = result.content?.find((c: any) => c.type === 'text');
    if (!textContent) {
      throw new Error(`No text content in response for tool: ${name}`);
    }
    return JSON.parse(textContent.text);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
```

**Step 4: Run test to verify it passes**
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run src/transport/__tests__/mcp.test.ts
```
Expected: PASS

**Step 5: Commit**
```bash
git add packages/sdk/src/transport/mcp.ts packages/sdk/src/transport/__tests__/mcp.test.ts
git commit -m "feat(sdk): add McpTransport using Streamable HTTP"
```
## Phase 1: Core + DEX (continued)

### Task 8: REST transport

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/rest.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/__tests__/rest.test.ts`

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/__tests__/rest.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestTransport } from '../rest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('RestTransport', () => {
  let transport: RestTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new RestTransport('https://api.mangrovemarkets.com', 'test-key');
  });

  it('callTool sends POST to /api/tools/{name}', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ quoteId: 'q-1' }),
    });

    const result = await transport.callTool('dex_get_quote', { src: '0xa', dst: '0xb' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.mangrovemarkets.com/api/tools/dex_get_quote',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
        },
        body: JSON.stringify({ src: '0xa', dst: '0xb' }),
      },
    );
    expect(result).toEqual({ quoteId: 'q-1' });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: true, message: 'Server error' }),
    });

    await expect(transport.callTool('dex_get_quote', {})).rejects.toThrow('500');
  });

  it('connect and disconnect are no-ops', async () => {
    await expect(transport.connect()).resolves.toBeUndefined();
    await expect(transport.disconnect()).resolves.toBeUndefined();
  });

  it('omits Authorization header when no apiKey', async () => {
    const noAuth = new RestTransport('https://api.mangrovemarkets.com');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    await noAuth.callTool('dex_get_quote', {});

    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers).not.toHaveProperty('Authorization');
  });
});
```

**Step 2:** Run test — FAIL
**Step 3:** Implementation:
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/transport/rest.ts
import type { Transport, ToolCallResult } from '../types/transport';

export class RestTransport implements Transport {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/api/tools/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        `REST call to ${name} failed (${response.status}): ${body.message || response.statusText}`,
      );
    }

    return response.json();
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
```

**Step 4:** Run test — PASS
**Step 5:** Commit:
```bash
git add packages/sdk/src/transport/rest.ts packages/sdk/src/transport/__tests__/rest.test.ts
git commit -m "feat(sdk): add RestTransport using native fetch"
```

---

### Task 9: DexService (low-level API)

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/service.ts`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/types.ts`
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/index.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/__tests__/service.test.ts`

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/__tests__/service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DexService } from '../service';
import { MockTransport } from '../../transport/__tests__/mock';
import type { Quote, UnsignedTransaction, BroadcastResult, TransactionStatus } from '../../types';

describe('DexService', () => {
  let transport: MockTransport;
  let dex: DexService;

  beforeEach(() => {
    transport = new MockTransport();
    dex = new DexService(transport);
  });

  it('getQuote calls dex_get_quote and returns Quote', async () => {
    const mockQuote: Quote = {
      quoteId: 'q-123',
      venueId: '1inch',
      inputToken: '0xA0b8...',
      outputToken: '0xEeee...',
      inputAmount: '1000000000',
      outputAmount: '500000000000000000',
      mangroveFee: '0.25',
      chainId: 8453,
      billingMode: 'standard',
      routes: ['1inch-classic'],
      expiresAt: '2026-02-24T12:00:00Z',
    };
    transport.addResponse('dex_get_quote', mockQuote as any);

    const result = await dex.getQuote({ src: '0xA0b8...', dst: '0xEeee...', amount: '1000000000', chainId: 8453 });

    expect(result.quoteId).toBe('q-123');
    expect(transport.calls[0].name).toBe('dex_get_quote');
    expect(transport.calls[0].params.src).toBe('0xA0b8...');
  });

  it('prepareSwap calls dex_prepare_swap and returns UnsignedTransaction', async () => {
    const mockTx: UnsignedTransaction = {
      chainId: 8453,
      to: '0x1111...',
      data: '0x12aa3caf...',
      value: '0',
      gas: '200000',
    };
    transport.addResponse('dex_prepare_swap', mockTx as any);

    const result = await dex.prepareSwap('q-123', 0.5);

    expect(result.to).toBe('0x1111...');
    expect(transport.calls[0].params.quote_id).toBe('q-123');
    expect(transport.calls[0].params.slippage).toBe(0.5);
  });

  it('approveToken calls dex_approve_token and returns UnsignedTransaction', async () => {
    const mockTx: UnsignedTransaction = {
      chainId: 8453,
      to: '0xA0b8...',
      data: '0x095ea7b3...',
      value: '0',
      gas: '50000',
    };
    transport.addResponse('dex_approve_token', mockTx as any);

    const result = await dex.approveToken({ tokenAddress: '0xA0b8...', chainId: 8453 });

    expect(result.data).toContain('0x095ea7b3');
    expect(transport.calls[0].params.token_address).toBe('0xA0b8...');
  });

  it('broadcast calls dex_broadcast and returns BroadcastResult', async () => {
    const mockResult: BroadcastResult = {
      txHash: '0xabc123',
      chainId: 8453,
      broadcastMethod: 'public',
    };
    transport.addResponse('dex_broadcast', mockResult as any);

    const result = await dex.broadcast({ chainId: 8453, signedTx: '0xsigned', mevProtection: false });

    expect(result.txHash).toBe('0xabc123');
    expect(transport.calls[0].params.signed_tx).toBe('0xsigned');
  });

  it('swapStatus calls dex_swap_status and returns TransactionStatus', async () => {
    const mockStatus: TransactionStatus = {
      txHash: '0xabc123',
      chainId: 8453,
      status: 'confirmed',
      blockNumber: 12345,
      gasUsed: '180000',
    };
    transport.addResponse('dex_swap_status', mockStatus as any);

    const result = await dex.swapStatus({ txHash: '0xabc123', chainId: 8453 });

    expect(result.status).toBe('confirmed');
  });

  it('supportedChains calls dex_supported_chains', async () => {
    transport.addResponse('dex_supported_chains', { chains: [{ id: 1, name: 'Ethereum' }, { id: 8453, name: 'Base' }] });
    const result = await dex.supportedChains();
    expect(result.chains).toHaveLength(2);
  });

  it('supportedPairs calls dex_supported_pairs', async () => {
    transport.addResponse('dex_supported_pairs', { pairs: [{ base: 'ETH', quote: 'USDC' }] });
    const result = await dex.supportedPairs(8453);
    expect(transport.calls[0].params.chain_id).toBe(8453);
  });
});
```

**Step 2:** Run test — FAIL
**Step 3:** Implementation:

```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/types.ts
export type {
  Quote,
  UnsignedTransaction,
  BroadcastResult,
  TransactionStatus,
  SwapResult,
  QuoteParams,
  SwapParams,
  ApproveParams,
  BroadcastParams,
  SwapStatusParams,
  BillingMode,
} from '../types/dex';
```

```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/service.ts
import type { Transport, ToolCallResult } from '../types/transport';
import type {
  Quote,
  UnsignedTransaction,
  BroadcastResult,
  TransactionStatus,
  QuoteParams,
  ApproveParams,
  BroadcastParams,
  SwapStatusParams,
} from '../types/dex';

export class DexService {
  constructor(private transport: Transport) {}

  async getQuote(params: QuoteParams): Promise<Quote> {
    const result = await this.transport.callTool('dex_get_quote', {
      src: params.src,
      dst: params.dst,
      amount: params.amount,
      chain_id: params.chainId,
      mode: params.mode || 'standard',
    });
    return result as unknown as Quote;
  }

  async prepareSwap(quoteId: string, slippage: number = 0.5): Promise<UnsignedTransaction> {
    const result = await this.transport.callTool('dex_prepare_swap', {
      quote_id: quoteId,
      slippage,
    });
    return result as unknown as UnsignedTransaction;
  }

  async approveToken(params: ApproveParams): Promise<UnsignedTransaction> {
    const result = await this.transport.callTool('dex_approve_token', {
      token_address: params.tokenAddress,
      chain_id: params.chainId,
      ...(params.amount ? { amount: params.amount } : {}),
    });
    return result as unknown as UnsignedTransaction;
  }

  async broadcast(params: BroadcastParams): Promise<BroadcastResult> {
    const result = await this.transport.callTool('dex_broadcast', {
      chain_id: params.chainId,
      signed_tx: params.signedTx,
      mev_protection: params.mevProtection || false,
    });
    return result as unknown as BroadcastResult;
  }

  async swapStatus(params: SwapStatusParams): Promise<TransactionStatus> {
    const result = await this.transport.callTool('dex_swap_status', {
      tx_hash: params.txHash,
      chain_id: params.chainId,
    });
    return result as unknown as TransactionStatus;
  }

  async supportedChains(): Promise<ToolCallResult> {
    return this.transport.callTool('dex_supported_chains', {});
  }

  async supportedPairs(chainId?: number, venue?: string): Promise<ToolCallResult> {
    return this.transport.callTool('dex_supported_pairs', {
      ...(chainId ? { chain_id: chainId } : {}),
      ...(venue ? { venue } : {}),
    });
  }
}
```

```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/index.ts
export { DexService } from './service';
export * from './types';
```

**Step 4:** Run test — PASS
**Step 5:** Commit:
```bash
git add packages/sdk/src/dex/
git commit -m "feat(sdk): add DexService wrapping all dex_* MCP tools"
```

---

### Task 10: SwapOrchestrator (high-level)

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/swap.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/__tests__/swap.test.ts`

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/__tests__/swap.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwapOrchestrator } from '../swap';
import { DexService } from '../service';
import { MockTransport } from '../../transport/__tests__/mock';
import type { Signer } from '../../types';

// Native ETH address constant
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

function createMockSigner(): Signer {
  return {
    getAddress: vi.fn().mockResolvedValue('0xUserWallet'),
    signTransaction: vi.fn().mockResolvedValue('0xsigned_hex'),
    getSupportedChainIds: vi.fn().mockResolvedValue([1, 8453]),
  };
}

describe('SwapOrchestrator', () => {
  let transport: MockTransport;
  let dex: DexService;
  let signer: Signer;
  let orchestrator: SwapOrchestrator;

  beforeEach(() => {
    transport = new MockTransport();
    dex = new DexService(transport);
    signer = createMockSigner();
    orchestrator = new SwapOrchestrator(dex, signer);
  });

  it('swaps native token (no approval needed)', async () => {
    // Quote
    transport.addResponse('dex_get_quote', {
      quoteId: 'q-1', venueId: '1inch', inputToken: NATIVE_TOKEN,
      outputToken: '0xUSDC', inputAmount: '1000000000000000000',
      outputAmount: '2000000000', mangroveFee: '0.25', chainId: 8453,
      billingMode: 'standard', routes: ['1inch'], expiresAt: '2026-02-25T00:00:00Z',
    });
    // Prepare swap
    transport.addResponse('dex_prepare_swap', {
      chainId: 8453, to: '0x1inch', data: '0xswapdata', value: '1000000000000000000', gas: '200000',
    });
    // Broadcast
    transport.addResponse('dex_broadcast', {
      txHash: '0xtxhash', chainId: 8453, broadcastMethod: 'public',
    });
    // Status - confirmed
    transport.addResponse('dex_swap_status', {
      txHash: '0xtxhash', chainId: 8453, status: 'confirmed', blockNumber: 100, gasUsed: '180000',
    });

    const result = await orchestrator.swap({
      src: NATIVE_TOKEN, dst: '0xUSDC', amount: '1000000000000000000',
      chainId: 8453, slippage: 0.5,
    });

    expect(result.txHash).toBe('0xtxhash');
    expect(result.status).toBe('confirmed');
    // Should NOT have called dex_approve_token
    const approvalCalls = transport.calls.filter(c => c.name === 'dex_approve_token');
    expect(approvalCalls).toHaveLength(0);
    // Should have signed exactly once (the swap tx)
    expect(signer.signTransaction).toHaveBeenCalledTimes(1);
  });

  it('swaps ERC20 token (needs approval)', async () => {
    // Quote
    transport.addResponse('dex_get_quote', {
      quoteId: 'q-2', venueId: '1inch', inputToken: '0xUSDC',
      outputToken: NATIVE_TOKEN, inputAmount: '2000000000',
      outputAmount: '1000000000000000000', mangroveFee: '0.25', chainId: 8453,
      billingMode: 'standard', routes: ['1inch'], expiresAt: '2026-02-25T00:00:00Z',
    });
    // Allowance check (via oneinch_allowances - returns 0 meaning approval needed)
    transport.addResponse('oneinch_allowances', { '0xUSDC': '0' });
    // Approve token
    transport.addResponse('dex_approve_token', {
      chainId: 8453, to: '0xUSDC', data: '0xapprovedata', value: '0', gas: '50000',
    });
    // Broadcast approval
    transport.addResponse('dex_broadcast', {
      txHash: '0xapproval_hash', chainId: 8453, broadcastMethod: 'public',
    });
    // Approval status confirmed
    transport.addResponse('dex_swap_status', {
      txHash: '0xapproval_hash', chainId: 8453, status: 'confirmed', blockNumber: 99, gasUsed: '45000',
    });
    // Prepare swap
    transport.addResponse('dex_prepare_swap', {
      chainId: 8453, to: '0x1inch', data: '0xswapdata', value: '0', gas: '200000',
    });
    // Broadcast swap
    transport.addResponse('dex_broadcast', {
      txHash: '0xswap_hash', chainId: 8453, broadcastMethod: 'public',
    });
    // Swap status confirmed
    transport.addResponse('dex_swap_status', {
      txHash: '0xswap_hash', chainId: 8453, status: 'confirmed', blockNumber: 101, gasUsed: '180000',
    });

    const result = await orchestrator.swap({
      src: '0xUSDC', dst: NATIVE_TOKEN, amount: '2000000000', chainId: 8453,
    });

    expect(result.txHash).toBe('0xswap_hash');
    expect(result.status).toBe('confirmed');
    // Should have signed twice (approval + swap)
    expect(signer.signTransaction).toHaveBeenCalledTimes(2);
  });

  it('returns error on failed swap', async () => {
    transport.addResponse('dex_get_quote', {
      quoteId: 'q-3', venueId: '1inch', inputToken: NATIVE_TOKEN,
      outputToken: '0xUSDC', inputAmount: '1000', outputAmount: '2000',
      mangroveFee: '0.25', chainId: 1, billingMode: 'standard',
      routes: ['1inch'], expiresAt: '2026-02-25T00:00:00Z',
    });
    transport.addResponse('dex_prepare_swap', {
      chainId: 1, to: '0x1inch', data: '0xswap', value: '1000', gas: '200000',
    });
    transport.addResponse('dex_broadcast', {
      txHash: '0xfailed', chainId: 1, broadcastMethod: 'public',
    });
    transport.addResponse('dex_swap_status', {
      txHash: '0xfailed', chainId: 1, status: 'failed',
    });

    const result = await orchestrator.swap({
      src: NATIVE_TOKEN, dst: '0xUSDC', amount: '1000', chainId: 1,
    });

    expect(result.status).toBe('failed');
  });
});
```

**Step 2:** Run test — FAIL
**Step 3:** Implementation:

```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/dex/swap.ts
import type { Signer } from '../types/signer';
import type { SwapParams, SwapResult, TransactionStatus } from '../types/dex';
import type { Transport } from '../types/transport';
import { DexService } from './service';

const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 60;

export class SwapOrchestrator {
  private dex: DexService;
  private signer: Signer;
  private transport: Transport;

  constructor(dex: DexService, signer: Signer, transport?: Transport) {
    this.dex = dex;
    this.signer = signer;
    // Transport is needed for allowance check; DexService already has it
    // We pass it through DexService's transport reference
    this.transport = transport || (dex as any).transport;
  }

  async swap(params: SwapParams): Promise<SwapResult> {
    const slippage = params.slippage ?? 0.5;
    const mevProtection = params.mevProtection ?? false;
    const mode = params.mode ?? 'standard';

    // 1. Get quote
    const quote = await this.dex.getQuote({
      src: params.src,
      dst: params.dst,
      amount: params.amount,
      chainId: params.chainId,
      mode,
    });

    // 2. Check if approval needed (skip for native tokens)
    const isNativeToken = params.src.toLowerCase() === NATIVE_TOKEN.toLowerCase();
    if (!isNativeToken) {
      const needsApproval = await this.checkNeedsApproval(params.src, params.chainId);
      if (needsApproval) {
        await this.approveAndWait(params.src, params.chainId);
      }
    }

    // 3. Prepare swap
    const unsignedTx = await this.dex.prepareSwap(quote.quoteId, slippage);

    // 4. Sign
    const signedTx = await this.signer.signTransaction(unsignedTx);

    // 5. Broadcast
    const broadcastResult = await this.dex.broadcast({
      chainId: params.chainId,
      signedTx,
      mevProtection,
    });

    // 6. Poll for confirmation
    const status = await this.pollStatus(broadcastResult.txHash, params.chainId);

    return {
      txHash: broadcastResult.txHash,
      chainId: params.chainId,
      status: status.status as 'confirmed' | 'failed',
      gasUsed: status.gasUsed || '0',
      inputToken: quote.inputToken,
      outputToken: quote.outputToken,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
    };
  }

  private async checkNeedsApproval(tokenAddress: string, chainId: number): Promise<boolean> {
    try {
      const walletAddress = await this.signer.getAddress();
      const result = await this.transport.callTool('oneinch_allowances', {
        chain_id: chainId,
        wallet_address: walletAddress,
        spender: 'router',
      });
      const allowances = result as Record<string, string>;
      const allowance = allowances[tokenAddress] || '0';
      return allowance === '0' || BigInt(allowance) === 0n;
    } catch {
      // If allowance check fails, assume approval is needed
      return true;
    }
  }

  private async approveAndWait(tokenAddress: string, chainId: number): Promise<void> {
    const approveTx = await this.dex.approveToken({ tokenAddress, chainId });
    const signedApproval = await this.signer.signTransaction(approveTx);
    const approvalBroadcast = await this.dex.broadcast({
      chainId,
      signedTx: signedApproval,
    });
    await this.pollStatus(approvalBroadcast.txHash, chainId);
  }

  private async pollStatus(txHash: string, chainId: number): Promise<TransactionStatus> {
    for (let i = 0; i < MAX_POLLS; i++) {
      const status = await this.dex.swapStatus({ txHash, chainId });
      if (status.status === 'confirmed' || status.status === 'failed') {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error(`Transaction ${txHash} did not confirm within ${MAX_POLLS * POLL_INTERVAL_MS / 1000}s`);
  }
}
```

**Step 4:** Run test — PASS
**Step 5:** Commit:
```bash
git add packages/sdk/src/dex/swap.ts packages/sdk/src/dex/__tests__/swap.test.ts
git commit -m "feat(sdk): add SwapOrchestrator for high-level approve->sign->broadcast->poll flow"
```

---

### Task 11: MangroveClient

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/client.ts`
- Delete: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/client/MangroveClient.ts` (old file)
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/__tests__/client.test.ts`

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MangroveClient } from '../client';
import type { Signer } from '../types';

vi.mock('../transport/mcp', () => ({
  McpTransport: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock('../transport/rest', () => ({
  RestTransport: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({}),
  })),
}));

const mockSigner: Signer = {
  getAddress: vi.fn().mockResolvedValue('0xWallet'),
  signTransaction: vi.fn().mockResolvedValue('0xsigned'),
  getSupportedChainIds: vi.fn().mockResolvedValue([1, 8453]),
};

describe('MangroveClient', () => {
  it('creates MCP transport by default', () => {
    const client = new MangroveClient({
      url: 'https://api.mangrovemarkets.com',
      signer: mockSigner,
    });
    expect(client).toBeDefined();
  });

  it('creates REST transport when specified', () => {
    const client = new MangroveClient({
      url: 'https://api.mangrovemarkets.com',
      signer: mockSigner,
      transport: 'rest',
    });
    expect(client).toBeDefined();
  });

  it('exposes dex service', () => {
    const client = new MangroveClient({
      url: 'https://api.mangrovemarkets.com',
      signer: mockSigner,
    });
    expect(client.dex).toBeDefined();
    expect(client.dex.getQuote).toBeDefined();
    expect(client.dex.swap).toBeDefined();
  });

  it('connect delegates to transport', async () => {
    const client = new MangroveClient({
      url: 'https://api.mangrovemarkets.com',
      signer: mockSigner,
    });
    await client.connect();
  });

  it('disconnect delegates to transport', async () => {
    const client = new MangroveClient({
      url: 'https://api.mangrovemarkets.com',
      signer: mockSigner,
    });
    await client.connect();
    await client.disconnect();
  });
});
```

**Step 2:** Run test — FAIL
**Step 3:** Implementation:

```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/client.ts
import type { MangroveConfig } from './types/config';
import type { Transport } from './types/transport';
import type { SwapParams, SwapResult } from './types/dex';
import { McpTransport } from './transport/mcp';
import { RestTransport } from './transport/rest';
import { DexService } from './dex/service';
import { SwapOrchestrator } from './dex/swap';

interface DexClientApi extends DexService {
  swap(params: SwapParams): Promise<SwapResult>;
}

export class MangroveClient {
  private transport: Transport;
  private _dex: DexService;
  private _swapOrchestrator?: SwapOrchestrator;
  private config: MangroveConfig;

  constructor(config: MangroveConfig) {
    this.config = config;

    if (config.transport === 'rest') {
      this.transport = new RestTransport(config.url, config.apiKey);
    } else {
      this.transport = new McpTransport(config.url, config.apiKey);
    }

    this._dex = new DexService(this.transport);

    if (config.signer) {
      this._swapOrchestrator = new SwapOrchestrator(this._dex, config.signer, this.transport);
    }
  }

  get dex(): DexClientApi {
    const service = this._dex;
    const orchestrator = this._swapOrchestrator;

    return new Proxy(service, {
      get(target, prop) {
        if (prop === 'swap') {
          if (!orchestrator) {
            throw new Error('Signer required for swap(). Pass a signer in MangroveConfig.');
          }
          return orchestrator.swap.bind(orchestrator);
        }
        const value = (target as any)[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as DexClientApi;
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }
}
```

**Step 4:** Run test — PASS
**Step 5:** Commit:
```bash
git add packages/sdk/src/client.ts packages/sdk/src/__tests__/client.test.ts
git rm packages/sdk/src/client/MangroveClient.ts
git commit -m "feat(sdk): add MangroveClient with transport selection and dex.swap() proxy"
```

---

### Task 12: SDK barrel exports

**Files:**
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/index.ts`
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/marketplace/index.ts`
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/wallet/index.ts`

No tests needed — just re-exports.

**Step 1:** Rewrite `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/index.ts`:
```typescript
// Main client
export { MangroveClient } from './client';

// Types
export type {
  MangroveConfig,
  Quote,
  UnsignedTransaction,
  BroadcastResult,
  TransactionStatus,
  SwapResult,
  SwapParams,
  QuoteParams,
  ApproveParams,
  BroadcastParams,
  SwapStatusParams,
  BillingMode,
  Transport,
  ToolCallResult,
  Signer,
} from './types';

// Services
export { DexService } from './dex';

// Signer
export { EthersSigner } from './signer/ethers';

// Transports
export { McpTransport } from './transport/mcp';
export { RestTransport } from './transport/rest';
```

**Step 2:** Simplify `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/marketplace/index.ts`:
```typescript
// Marketplace module — placeholder for future marketplace SDK features
```

**Step 3:** Simplify `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/wallet/index.ts`:
```typescript
// Wallet module — placeholder for future wallet SDK features
```

**Step 4:** Run full test suite:
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run
```
Expected: ALL PASS

**Step 5:** Commit:
```bash
git add packages/sdk/src/index.ts packages/sdk/src/marketplace/index.ts packages/sdk/src/wallet/index.ts
git commit -m "refactor(sdk): clean up barrel exports, remove broken Python imports"
```

---

### Task 13: Placeholder packages + examples

**Files:**
- Rename: `packages/plugin/` to `packages/openclaw-plugin/` (or create new)
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/openclaw-plugin/package.json`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/openclaw-plugin/README.md`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/claude-plugin/package.json`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/claude-plugin/README.md`
- Rewrite: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/examples/basic.ts`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/examples/high-level-swap.ts`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/examples/low-level-swap.ts`

No tests — examples and placeholders only.

**Step 1:** Create `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/openclaw-plugin/package.json`:
```json
{
  "name": "@mangrove-one/openclaw-plugin",
  "version": "0.1.0",
  "description": "OpenClaw plugin for Mangrove Markets",
  "private": true,
  "license": "MIT"
}
```

**Step 2:** Create `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/openclaw-plugin/README.md`:
```markdown
# @mangrove-one/openclaw-plugin

OpenClaw plugin for Mangrove Markets DEX aggregation. Phase 5.
```

**Step 3:** Create `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/claude-plugin/package.json`:
```json
{
  "name": "@mangrove-one/claude-plugin",
  "version": "0.1.0",
  "description": "Claude plugin for Mangrove Markets",
  "private": true,
  "license": "MIT"
}
```

**Step 4:** Create `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/claude-plugin/README.md`:
```markdown
# @mangrove-one/claude-plugin

Claude plugin for Mangrove Markets DEX aggregation. Phase 5.
```

**Step 5:** Rewrite `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/examples/basic.ts`:
```typescript
import { MangroveClient, EthersSigner } from '@mangrove-one/mangrovemarkets';
// import { Wallet } from 'ethers'; // uncomment with real wallet

async function main() {
  // const wallet = new Wallet(process.env.PRIVATE_KEY!);
  // const signer = new EthersSigner(wallet, [1, 8453, 42161]);

  const client = new MangroveClient({
    url: process.env.MANGROVE_URL || 'https://api.mangrovemarkets.com',
    // signer,
    transport: 'mcp',
  });

  await client.connect();

  // Get a quote
  const quote = await client.dex.getQuote({
    src: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    dst: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
    amount: '1000000000', // 1000 USDC
    chainId: 8453,
  });

  console.log('Quote:', quote);
  await client.disconnect();
}

main().catch(console.error);
```

**Step 6:** Create `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/examples/high-level-swap.ts`:
```typescript
import { MangroveClient, EthersSigner } from '@mangrove-one/mangrovemarkets';
import { Wallet } from 'ethers';

async function main() {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const signer = new EthersSigner(wallet, [1, 8453, 42161]);

  const client = new MangroveClient({
    url: 'https://api.mangrovemarkets.com',
    signer,
    transport: 'mcp',
  });

  await client.connect();

  // One-call swap: handles approval, signing, broadcast, and polling
  const result = await client.dex.swap({
    src: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    dst: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
    amount: '1000000000',
    chainId: 8453,
    slippage: 0.5,
    mevProtection: true,
    mode: 'standard', // Fee captured in swap (0.25%)
  });

  console.log('Swap result:', result);
  // { txHash, chainId, status, gasUsed, inputToken, outputToken, inputAmount, outputAmount }

  await client.disconnect();
}

main().catch(console.error);
```

**Step 7:** Create `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/examples/low-level-swap.ts`:
```typescript
import { MangroveClient, EthersSigner } from '@mangrove-one/mangrovemarkets';
import { Wallet } from 'ethers';

async function main() {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const signer = new EthersSigner(wallet, [1, 8453]);

  const client = new MangroveClient({
    url: 'https://api.mangrovemarkets.com',
    signer,
  });

  await client.connect();

  // Step 1: Get quote
  const quote = await client.dex.getQuote({
    src: '0xUSDC_ADDRESS',
    dst: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    amount: '1000000000',
    chainId: 8453,
  });
  console.log('Quote:', quote.quoteId, 'output:', quote.outputAmount);

  // Step 2: Approve token (ERC20 only)
  const approvalTx = await client.dex.approveToken({
    tokenAddress: '0xUSDC_ADDRESS',
    chainId: 8453,
  });
  const signedApproval = await signer.signTransaction(approvalTx);
  const approvalResult = await client.dex.broadcast({
    chainId: 8453,
    signedTx: signedApproval,
  });
  console.log('Approval tx:', approvalResult.txHash);

  // Step 3: Prepare and sign swap
  const swapTx = await client.dex.prepareSwap(quote.quoteId, 0.5);
  const signedSwap = await signer.signTransaction(swapTx);
  const { txHash } = await client.dex.broadcast({
    chainId: 8453,
    signedTx: signedSwap,
    mevProtection: true,
  });
  console.log('Swap tx:', txHash);

  // Step 4: Poll status
  let status = await client.dex.swapStatus({ txHash, chainId: 8453 });
  while (status.status === 'pending') {
    await new Promise(r => setTimeout(r, 3000));
    status = await client.dex.swapStatus({ txHash, chainId: 8453 });
  }
  console.log('Final status:', status);

  await client.disconnect();
}

main().catch(console.error);
```

**Step 8:** Run full test suite:
```bash
cd /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets && pnpm --filter @mangrove-one/mangrovemarkets test -- --run
```
Expected: ALL PASS

**Step 9:** Commit:
```bash
git add packages/openclaw-plugin/ packages/claude-plugin/ packages/sdk/examples/
git commit -m "chore(sdk): add placeholder packages and updated examples"
```

---

## Phase 2: OneInch Service (Tasks 14-16)

> Phase 2 depends on MCP Server Phase 2 (Ancillary APIs). Lighter TDD detail -- provide types, test outlines, and implementation outlines.

### Task 14: OneInch types

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/oneinch.ts`
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/index.ts` (add oneinch re-export)
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/types.ts`

**Types to define:**

```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/oneinch.ts

export interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  balance: string;
  balanceUsd: string;
}

export interface Allowance {
  tokenAddress: string;
  spender: string;
  allowance: string;
}

export interface SpotPrice {
  tokenAddress: string;
  priceUsd: string;
}

export interface GasPrice {
  fast: string;
  medium: string;
  slow: string;
}

export interface TokenSearchResult {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
}

export interface TokenInfo extends TokenSearchResult {
  totalSupply: string;
  priceUsd: string;
}

export interface BalancesParams {
  chainId: number;
  wallet: string;
}

export interface AllowancesParams {
  chainId: number;
  wallet: string;
  spender: string;
}

export interface SpotPriceParams {
  chainId: number;
  tokens: string[];
}

export interface GasPriceParams {
  chainId: number;
}

export interface TokenSearchParams {
  chainId: number;
  query: string;
}

export interface TokenInfoParams {
  chainId: number;
  address: string;
}
```

```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/types.ts
export type {
  TokenBalance,
  Allowance,
  SpotPrice,
  GasPrice,
  TokenSearchResult,
  TokenInfo,
  BalancesParams,
  AllowancesParams,
  SpotPriceParams,
  GasPriceParams,
  TokenSearchParams,
  TokenInfoParams,
} from '../types/oneinch';
```

**Update** `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/index.ts`:
```typescript
export * from './dex';
export * from './transport';
export * from './signer';
export * from './config';
export * from './oneinch';
```

**Commit:**
```bash
git add packages/sdk/src/types/oneinch.ts packages/sdk/src/types/index.ts packages/sdk/src/oneinch/types.ts
git commit -m "feat(sdk): add OneInch types for balance, pricing, and token APIs"
```

---

### Task 15: OneInchService -- balance & allowances

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/index.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/__tests__/service.test.ts`

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/__tests__/service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { OneInchService } from '../index';
import { MockTransport } from '../../transport/__tests__/mock';
import type { TokenBalance, Allowance } from '../../types';

describe('OneInchService — balance & allowances', () => {
  let transport: MockTransport;
  let oneinch: OneInchService;

  beforeEach(() => {
    transport = new MockTransport();
    oneinch = new OneInchService(transport);
  });

  it('getBalances calls oneinch_balances and returns TokenBalance[]', async () => {
    const mockBalances: TokenBalance[] = [
      { tokenAddress: '0xUSDC', symbol: 'USDC', balance: '1000000000', balanceUsd: '1000.00' },
      { tokenAddress: '0xWETH', symbol: 'WETH', balance: '500000000000000000', balanceUsd: '1250.00' },
    ];
    transport.addResponse('oneinch_balances', { balances: mockBalances } as any);

    const result = await oneinch.getBalances({ chainId: 8453, wallet: '0xMyWallet' });

    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('USDC');
    expect(transport.calls[0].name).toBe('oneinch_balances');
    expect(transport.calls[0].params.chain_id).toBe(8453);
    expect(transport.calls[0].params.wallet).toBe('0xMyWallet');
  });

  it('getAllowances calls oneinch_allowances and returns Allowance[]', async () => {
    const mockAllowances: Allowance[] = [
      { tokenAddress: '0xUSDC', spender: '0xRouter', allowance: '115792089237316195423570985008687907853269984665640564039457584007913129639935' },
    ];
    transport.addResponse('oneinch_allowances', { allowances: mockAllowances } as any);

    const result = await oneinch.getAllowances({ chainId: 8453, wallet: '0xMyWallet', spender: '0xRouter' });

    expect(result).toHaveLength(1);
    expect(result[0].tokenAddress).toBe('0xUSDC');
    expect(transport.calls[0].name).toBe('oneinch_allowances');
    expect(transport.calls[0].params.chain_id).toBe(8453);
    expect(transport.calls[0].params.wallet).toBe('0xMyWallet');
    expect(transport.calls[0].params.spender).toBe('0xRouter');
  });
});
```

**Step 2:** Run test — FAIL
**Step 3:** Implementation:

```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/index.ts
import type { Transport, ToolCallResult } from '../types/transport';
import type {
  TokenBalance,
  Allowance,
  SpotPrice,
  GasPrice,
  TokenSearchResult,
  TokenInfo,
  BalancesParams,
  AllowancesParams,
  SpotPriceParams,
  GasPriceParams,
  TokenSearchParams,
  TokenInfoParams,
} from '../types/oneinch';

export class OneInchService {
  constructor(private transport: Transport) {}

  async getBalances(params: BalancesParams): Promise<TokenBalance[]> {
    const result = await this.transport.callTool('oneinch_balances', {
      chain_id: params.chainId,
      wallet: params.wallet,
    });
    return (result as any).balances as TokenBalance[];
  }

  async getAllowances(params: AllowancesParams): Promise<Allowance[]> {
    const result = await this.transport.callTool('oneinch_allowances', {
      chain_id: params.chainId,
      wallet: params.wallet,
      spender: params.spender,
    });
    return (result as any).allowances as Allowance[];
  }
}

export * from './types';
```

**Step 4:** Wire into MangroveClient — add `client.oneinch` property.

Update `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/client.ts` to add:
```typescript
import { OneInchService } from './oneinch';

// Inside MangroveClient class:
private _oneinch: OneInchService;

// In constructor:
this._oneinch = new OneInchService(this.transport);

// Public getter:
get oneinch(): OneInchService {
  return this._oneinch;
}
```

**Step 5:** Run test — PASS
**Step 6:** Commit:
```bash
git add packages/sdk/src/oneinch/ packages/sdk/src/client.ts
git commit -m "feat(sdk): add OneInchService with getBalances and getAllowances"
```

---

### Task 16: OneInchService -- pricing & tokens

**Files:**
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/index.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/__tests__/pricing.test.ts`

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/__tests__/pricing.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { OneInchService } from '../index';
import { MockTransport } from '../../transport/__tests__/mock';
import type { SpotPrice, GasPrice, TokenSearchResult, TokenInfo } from '../../types';

describe('OneInchService — pricing & tokens', () => {
  let transport: MockTransport;
  let oneinch: OneInchService;

  beforeEach(() => {
    transport = new MockTransport();
    oneinch = new OneInchService(transport);
  });

  it('getSpotPrice calls oneinch_spot_price and returns SpotPrice[]', async () => {
    const mockPrices: SpotPrice[] = [
      { tokenAddress: '0xUSDC', priceUsd: '1.00' },
      { tokenAddress: '0xWETH', priceUsd: '2500.00' },
    ];
    transport.addResponse('oneinch_spot_price', { prices: mockPrices } as any);

    const result = await oneinch.getSpotPrice({ chainId: 8453, tokens: ['0xUSDC', '0xWETH'] });

    expect(result).toHaveLength(2);
    expect(result[0].priceUsd).toBe('1.00');
    expect(transport.calls[0].name).toBe('oneinch_spot_price');
    expect(transport.calls[0].params.chain_id).toBe(8453);
    expect(transport.calls[0].params.tokens).toEqual(['0xUSDC', '0xWETH']);
  });

  it('getGasPrice calls oneinch_gas_price and returns GasPrice', async () => {
    const mockGas: GasPrice = { fast: '50', medium: '30', slow: '15' };
    transport.addResponse('oneinch_gas_price', mockGas as any);

    const result = await oneinch.getGasPrice({ chainId: 8453 });

    expect(result.fast).toBe('50');
    expect(result.medium).toBe('30');
    expect(result.slow).toBe('15');
    expect(transport.calls[0].name).toBe('oneinch_gas_price');
    expect(transport.calls[0].params.chain_id).toBe(8453);
  });

  it('searchTokens calls oneinch_token_search and returns TokenSearchResult[]', async () => {
    const mockResults: TokenSearchResult[] = [
      { address: '0xUSDC', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 8453 },
      { address: '0xUSDT', symbol: 'USDT', name: 'Tether', decimals: 6, chainId: 8453 },
    ];
    transport.addResponse('oneinch_token_search', { tokens: mockResults } as any);

    const result = await oneinch.searchTokens({ chainId: 8453, query: 'USD' });

    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('USDC');
    expect(transport.calls[0].name).toBe('oneinch_token_search');
    expect(transport.calls[0].params.chain_id).toBe(8453);
    expect(transport.calls[0].params.query).toBe('USD');
  });

  it('getTokenInfo calls oneinch_token_info and returns TokenInfo', async () => {
    const mockInfo: TokenInfo = {
      address: '0xUSDC',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 8453,
      totalSupply: '26000000000000000',
      priceUsd: '1.00',
      logoURI: 'https://tokens.1inch.io/usdc.png',
    };
    transport.addResponse('oneinch_token_info', mockInfo as any);

    const result = await oneinch.getTokenInfo({ chainId: 8453, address: '0xUSDC' });

    expect(result.symbol).toBe('USDC');
    expect(result.totalSupply).toBe('26000000000000000');
    expect(transport.calls[0].name).toBe('oneinch_token_info');
    expect(transport.calls[0].params.chain_id).toBe(8453);
    expect(transport.calls[0].params.address).toBe('0xUSDC');
  });
});
```

**Step 2:** Run test — FAIL
**Step 3:** Add methods to `OneInchService` in `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/index.ts`:

```typescript
  async getSpotPrice(params: SpotPriceParams): Promise<SpotPrice[]> {
    const result = await this.transport.callTool('oneinch_spot_price', {
      chain_id: params.chainId,
      tokens: params.tokens,
    });
    return (result as any).prices as SpotPrice[];
  }

  async getGasPrice(params: GasPriceParams): Promise<GasPrice> {
    const result = await this.transport.callTool('oneinch_gas_price', {
      chain_id: params.chainId,
    });
    return result as unknown as GasPrice;
  }

  async searchTokens(params: TokenSearchParams): Promise<TokenSearchResult[]> {
    const result = await this.transport.callTool('oneinch_token_search', {
      chain_id: params.chainId,
      query: params.query,
    });
    return (result as any).tokens as TokenSearchResult[];
  }

  async getTokenInfo(params: TokenInfoParams): Promise<TokenInfo> {
    const result = await this.transport.callTool('oneinch_token_info', {
      chain_id: params.chainId,
      address: params.address,
    });
    return result as unknown as TokenInfo;
  }
```

**Step 4:** Run test — PASS
**Step 5:** Commit:
```bash
git add packages/sdk/src/oneinch/
git commit -m "feat(sdk): add pricing and token discovery to OneInchService"
```

---

## Phase 3: Portfolio + Charts (Tasks 17-18)

> Phase 3 depends on MCP Server Phase 3.

### Task 17: OneInchService -- portfolio

**Files:**
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/oneinch.ts` (add portfolio types)
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/index.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/__tests__/portfolio.test.ts`

**New types to add to `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/oneinch.ts`:**
```typescript
export interface PortfolioValue {
  totalValueUsd: string;
  chains: { chainId: number; valueUsd: string }[];
}

export interface PortfolioPnl {
  totalPnlUsd: string;
  totalPnlPercent: string;
}

export interface PortfolioToken {
  tokenAddress: string;
  symbol: string;
  balance: string;
  valueUsd: string;
  chainId: number;
}

export interface PortfolioDefi {
  protocol: string;
  positionType: string;
  valueUsd: string;
  chainId: number;
}

export interface PortfolioValueParams {
  addresses: string[];
  chainId?: number;
}

export interface PortfolioPnlParams {
  addresses: string[];
  chainId?: number;
}

export interface PortfolioTokensParams {
  addresses: string[];
  chainId?: number;
}

export interface PortfolioDefiParams {
  addresses: string[];
  chainId?: number;
}
```

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/__tests__/portfolio.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { OneInchService } from '../index';
import { MockTransport } from '../../transport/__tests__/mock';
import type { PortfolioValue, PortfolioPnl, PortfolioToken, PortfolioDefi } from '../../types';

describe('OneInchService — portfolio', () => {
  let transport: MockTransport;
  let oneinch: OneInchService;

  beforeEach(() => {
    transport = new MockTransport();
    oneinch = new OneInchService(transport);
  });

  it('getPortfolioValue calls oneinch_portfolio_value and returns PortfolioValue', async () => {
    const mockValue: PortfolioValue = {
      totalValueUsd: '12500.00',
      chains: [
        { chainId: 1, valueUsd: '10000.00' },
        { chainId: 8453, valueUsd: '2500.00' },
      ],
    };
    transport.addResponse('oneinch_portfolio_value', mockValue as any);

    const result = await oneinch.getPortfolioValue({ addresses: ['0xWallet1'] });

    expect(result.totalValueUsd).toBe('12500.00');
    expect(result.chains).toHaveLength(2);
    expect(transport.calls[0].name).toBe('oneinch_portfolio_value');
    expect(transport.calls[0].params.addresses).toEqual(['0xWallet1']);
  });

  it('getPortfolioPnl calls oneinch_portfolio_pnl and returns PortfolioPnl', async () => {
    const mockPnl: PortfolioPnl = {
      totalPnlUsd: '1500.00',
      totalPnlPercent: '12.5',
    };
    transport.addResponse('oneinch_portfolio_pnl', mockPnl as any);

    const result = await oneinch.getPortfolioPnl({ addresses: ['0xWallet1'], chainId: 8453 });

    expect(result.totalPnlUsd).toBe('1500.00');
    expect(result.totalPnlPercent).toBe('12.5');
    expect(transport.calls[0].name).toBe('oneinch_portfolio_pnl');
    expect(transport.calls[0].params.addresses).toEqual(['0xWallet1']);
    expect(transport.calls[0].params.chain_id).toBe(8453);
  });

  it('getPortfolioTokens calls oneinch_portfolio_tokens and returns PortfolioToken[]', async () => {
    const mockTokens: PortfolioToken[] = [
      { tokenAddress: '0xUSDC', symbol: 'USDC', balance: '5000000000', valueUsd: '5000.00', chainId: 8453 },
      { tokenAddress: '0xWETH', symbol: 'WETH', balance: '3000000000000000000', valueUsd: '7500.00', chainId: 8453 },
    ];
    transport.addResponse('oneinch_portfolio_tokens', { tokens: mockTokens } as any);

    const result = await oneinch.getPortfolioTokens({ addresses: ['0xWallet1'], chainId: 8453 });

    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('USDC');
    expect(transport.calls[0].name).toBe('oneinch_portfolio_tokens');
  });

  it('getPortfolioDefi calls oneinch_portfolio_defi and returns PortfolioDefi[]', async () => {
    const mockDefi: PortfolioDefi[] = [
      { protocol: 'Aave', positionType: 'lending', valueUsd: '3000.00', chainId: 8453 },
      { protocol: 'Uniswap', positionType: 'liquidity', valueUsd: '2000.00', chainId: 8453 },
    ];
    transport.addResponse('oneinch_portfolio_defi', { positions: mockDefi } as any);

    const result = await oneinch.getPortfolioDefi({ addresses: ['0xWallet1'], chainId: 8453 });

    expect(result).toHaveLength(2);
    expect(result[0].protocol).toBe('Aave');
    expect(transport.calls[0].name).toBe('oneinch_portfolio_defi');
  });
});
```

**Step 2:** Run test — FAIL
**Step 3:** Add methods to `OneInchService`:

```typescript
  async getPortfolioValue(params: PortfolioValueParams): Promise<PortfolioValue> {
    const result = await this.transport.callTool('oneinch_portfolio_value', {
      addresses: params.addresses,
      ...(params.chainId ? { chain_id: params.chainId } : {}),
    });
    return result as unknown as PortfolioValue;
  }

  async getPortfolioPnl(params: PortfolioPnlParams): Promise<PortfolioPnl> {
    const result = await this.transport.callTool('oneinch_portfolio_pnl', {
      addresses: params.addresses,
      ...(params.chainId ? { chain_id: params.chainId } : {}),
    });
    return result as unknown as PortfolioPnl;
  }

  async getPortfolioTokens(params: PortfolioTokensParams): Promise<PortfolioToken[]> {
    const result = await this.transport.callTool('oneinch_portfolio_tokens', {
      addresses: params.addresses,
      ...(params.chainId ? { chain_id: params.chainId } : {}),
    });
    return (result as any).tokens as PortfolioToken[];
  }

  async getPortfolioDefi(params: PortfolioDefiParams): Promise<PortfolioDefi[]> {
    const result = await this.transport.callTool('oneinch_portfolio_defi', {
      addresses: params.addresses,
      ...(params.chainId ? { chain_id: params.chainId } : {}),
    });
    return (result as any).positions as PortfolioDefi[];
  }
```

**Step 4:** Run test — PASS
**Step 5:** Commit:
```bash
git add packages/sdk/src/types/oneinch.ts packages/sdk/src/oneinch/
git commit -m "feat(sdk): add portfolio APIs to OneInchService"
```

---

### Task 18: OneInchService -- chart & history

**Files:**
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/oneinch.ts` (add chart types)
- Modify: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/index.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/__tests__/chart.test.ts`

**New types to add to `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/types/oneinch.ts`:**
```typescript
export interface OhlcvCandle {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface HistoryEntry {
  txHash: string;
  timestamp: number;
  type: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  chainId: number;
}

export type ChartPeriod = '1h' | '4h' | '1d' | '1w' | '1M';

export interface ChartParams {
  chainId: number;
  token0: string;
  token1: string;
  period: ChartPeriod;
}

export interface HistoryParams {
  address: string;
}
```

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/oneinch/__tests__/chart.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { OneInchService } from '../index';
import { MockTransport } from '../../transport/__tests__/mock';
import type { OhlcvCandle, HistoryEntry } from '../../types';

describe('OneInchService — chart & history', () => {
  let transport: MockTransport;
  let oneinch: OneInchService;

  beforeEach(() => {
    transport = new MockTransport();
    oneinch = new OneInchService(transport);
  });

  it('getChart calls oneinch_chart and returns OhlcvCandle[]', async () => {
    const mockCandles: OhlcvCandle[] = [
      { timestamp: 1708732800, open: '2500.00', high: '2550.00', low: '2480.00', close: '2530.00', volume: '1000000' },
      { timestamp: 1708736400, open: '2530.00', high: '2560.00', low: '2510.00', close: '2545.00', volume: '850000' },
    ];
    transport.addResponse('oneinch_chart', { candles: mockCandles } as any);

    const result = await oneinch.getChart({
      chainId: 8453,
      token0: '0xWETH',
      token1: '0xUSDC',
      period: '1h',
    });

    expect(result).toHaveLength(2);
    expect(result[0].open).toBe('2500.00');
    expect(result[1].close).toBe('2545.00');
    expect(transport.calls[0].name).toBe('oneinch_chart');
    expect(transport.calls[0].params.chain_id).toBe(8453);
    expect(transport.calls[0].params.token0).toBe('0xWETH');
    expect(transport.calls[0].params.token1).toBe('0xUSDC');
    expect(transport.calls[0].params.period).toBe('1h');
  });

  it('getHistory calls oneinch_history and returns HistoryEntry[]', async () => {
    const mockHistory: HistoryEntry[] = [
      {
        txHash: '0xabc123',
        timestamp: 1708732800,
        type: 'swap',
        tokenIn: '0xUSDC',
        tokenOut: '0xWETH',
        amountIn: '2500000000',
        amountOut: '1000000000000000000',
        chainId: 8453,
      },
      {
        txHash: '0xdef456',
        timestamp: 1708729200,
        type: 'swap',
        tokenIn: '0xWETH',
        tokenOut: '0xUSDC',
        amountIn: '500000000000000000',
        amountOut: '1200000000',
        chainId: 8453,
      },
    ];
    transport.addResponse('oneinch_history', { history: mockHistory } as any);

    const result = await oneinch.getHistory({ address: '0xMyWallet' });

    expect(result).toHaveLength(2);
    expect(result[0].txHash).toBe('0xabc123');
    expect(result[0].type).toBe('swap');
    expect(transport.calls[0].name).toBe('oneinch_history');
    expect(transport.calls[0].params.address).toBe('0xMyWallet');
  });
});
```

**Step 2:** Run test — FAIL
**Step 3:** Add methods to `OneInchService`:

```typescript
  async getChart(params: ChartParams): Promise<OhlcvCandle[]> {
    const result = await this.transport.callTool('oneinch_chart', {
      chain_id: params.chainId,
      token0: params.token0,
      token1: params.token1,
      period: params.period,
    });
    return (result as any).candles as OhlcvCandle[];
  }

  async getHistory(params: HistoryParams): Promise<HistoryEntry[]> {
    const result = await this.transport.callTool('oneinch_history', {
      address: params.address,
    });
    return (result as any).history as HistoryEntry[];
  }
```

**Step 4:** Run test — PASS
**Step 5:** Commit:
```bash
git add packages/sdk/src/types/oneinch.ts packages/sdk/src/oneinch/
git commit -m "feat(sdk): add chart and history APIs to OneInchService"
```

---

## Phase 4: x402 Payment Handler (Task 19)

> Phase 4 depends on MCP Server Phase 4.

### Task 19: x402 handler

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/x402/handler.ts`
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/x402/types.ts`
- Test: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/x402/__tests__/handler.test.ts`

**Types:**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/x402/types.ts
export interface PaymentRequirements {
  /** Token contract address the server accepts for payment */
  paymentToken: string;
  /** Amount to pay (in token's smallest unit) */
  paymentAmount: string;
  /** Chain ID for the payment */
  chainId: number;
  /** Address to send payment to */
  paymentRecipient: string;
  /** Nonce to prevent replay */
  nonce: string;
  /** Human-readable description of what is being paid for */
  description: string;
}

export interface PaymentProof {
  /** Signed payment transaction hash or signed authorization */
  signature: string;
  /** The nonce from the requirements */
  nonce: string;
  /** Payer's address */
  payer: string;
  /** Chain ID used for payment */
  chainId: number;
}

export interface X402Response {
  /** The HTTP 402 status code */
  status: 402;
  /** Payment requirements parsed from the response */
  requirements: PaymentRequirements;
}
```

**Step 1: Write the failing test**
```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/x402/__tests__/handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { X402Handler } from '../handler';
import type { Signer } from '../../types';
import type { PaymentRequirements } from '../types';

function createMockSigner(): Signer {
  return {
    getAddress: vi.fn().mockResolvedValue('0xPayerWallet'),
    signTransaction: vi.fn().mockResolvedValue('0xsigned_payment'),
    getSupportedChainIds: vi.fn().mockResolvedValue([1, 8453]),
  };
}

describe('X402Handler', () => {
  let signer: Signer;
  let handler: X402Handler;

  beforeEach(() => {
    signer = createMockSigner();
    handler = new X402Handler(signer);
  });

  it('detects 402 response from error message', () => {
    const error = new Error('REST call to dex_get_quote failed (402): Payment Required');
    expect(handler.is402Error(error)).toBe(true);
  });

  it('does not false-positive on non-402 errors', () => {
    const error = new Error('REST call to dex_get_quote failed (500): Server error');
    expect(handler.is402Error(error)).toBe(false);
  });

  it('parseRequirements extracts payment details from error body', () => {
    const body = {
      status: 402,
      requirements: {
        paymentToken: '0xUSDC',
        paymentAmount: '250000',
        chainId: 8453,
        paymentRecipient: '0xMangroveVault',
        nonce: 'abc-123',
        description: 'DEX swap fee (0.25%)',
      },
    };

    const requirements = handler.parseRequirements(body);

    expect(requirements.paymentToken).toBe('0xUSDC');
    expect(requirements.paymentAmount).toBe('250000');
    expect(requirements.chainId).toBe(8453);
    expect(requirements.nonce).toBe('abc-123');
  });

  it('createPaymentProof signs a payment authorization', async () => {
    const requirements: PaymentRequirements = {
      paymentToken: '0xUSDC',
      paymentAmount: '250000',
      chainId: 8453,
      paymentRecipient: '0xMangroveVault',
      nonce: 'abc-123',
      description: 'DEX swap fee',
    };

    const proof = await handler.createPaymentProof(requirements);

    expect(proof.signature).toBe('0xsigned_payment');
    expect(proof.nonce).toBe('abc-123');
    expect(proof.payer).toBe('0xPayerWallet');
    expect(proof.chainId).toBe(8453);
    expect(signer.signTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 8453,
        to: '0xMangroveVault',
        value: '0',
      }),
    );
  });

  it('buildRetryHeaders creates X-Payment header', () => {
    const proof = {
      signature: '0xsigned_payment',
      nonce: 'abc-123',
      payer: '0xPayerWallet',
      chainId: 8453,
    };

    const headers = handler.buildRetryHeaders(proof);

    expect(headers['X-Payment']).toBeDefined();
    const parsed = JSON.parse(headers['X-Payment']);
    expect(parsed.signature).toBe('0xsigned_payment');
    expect(parsed.nonce).toBe('abc-123');
    expect(parsed.payer).toBe('0xPayerWallet');
  });
});
```

**Step 2:** Run test — FAIL
**Step 3:** Implementation:

```typescript
// /Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/x402/handler.ts
import type { Signer } from '../types/signer';
import type { UnsignedTransaction } from '../types/dex';
import type { PaymentRequirements, PaymentProof } from './types';

export class X402Handler {
  private signer: Signer;

  constructor(signer: Signer) {
    this.signer = signer;
  }

  /**
   * Detect whether an error represents an HTTP 402 Payment Required response.
   */
  is402Error(error: Error): boolean {
    return error.message.includes('(402)');
  }

  /**
   * Parse payment requirements from a 402 response body.
   */
  parseRequirements(body: Record<string, unknown>): PaymentRequirements {
    const req = body.requirements as Record<string, unknown>;
    if (!req) {
      throw new Error('402 response missing payment requirements');
    }
    return {
      paymentToken: req.paymentToken as string,
      paymentAmount: req.paymentAmount as string,
      chainId: req.chainId as number,
      paymentRecipient: req.paymentRecipient as string,
      nonce: req.nonce as string,
      description: req.description as string,
    };
  }

  /**
   * Create a signed payment proof that can be attached to a retry request.
   * Signs an ERC20 transfer (or native transfer) to the payment recipient.
   */
  async createPaymentProof(requirements: PaymentRequirements): Promise<PaymentProof> {
    const payerAddress = await this.signer.getAddress();

    // Build an unsigned transaction for the payment
    // For ERC20 tokens, this would be an approve or transfer call
    // For simplicity, we sign a transfer to the recipient
    const paymentTx: UnsignedTransaction = {
      chainId: requirements.chainId,
      to: requirements.paymentRecipient,
      data: this.encodeErc20Transfer(requirements.paymentRecipient, requirements.paymentAmount),
      value: '0',
      gas: '60000',
    };

    const signature = await this.signer.signTransaction(paymentTx);

    return {
      signature,
      nonce: requirements.nonce,
      payer: payerAddress,
      chainId: requirements.chainId,
    };
  }

  /**
   * Build headers for retrying the original request with payment proof.
   */
  buildRetryHeaders(proof: PaymentProof): Record<string, string> {
    return {
      'X-Payment': JSON.stringify({
        signature: proof.signature,
        nonce: proof.nonce,
        payer: proof.payer,
        chainId: proof.chainId,
      }),
    };
  }

  /**
   * Encode an ERC20 transfer(address,uint256) call.
   * Function selector: 0xa9059cbb
   */
  private encodeErc20Transfer(to: string, amount: string): string {
    // Simplified encoding — in production, use ethers.utils.defaultAbiCoder
    const paddedTo = to.replace('0x', '').padStart(64, '0');
    const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');
    return `0xa9059cbb${paddedTo}${paddedAmount}`;
  }
}
```

**Step 4:** Run test — PASS
**Step 5:** Integration with `SwapOrchestrator`:

When `mode: "x402"` is specified in swap params, the orchestrator should:
1. Catch 402 errors from `dex_get_quote` or `dex_prepare_swap`
2. Use `X402Handler` to parse requirements, create proof, and retry

This integration is done by modifying `SwapOrchestrator.swap()` to wrap tool calls in a try/catch that delegates to `X402Handler`. The orchestrator accepts an optional `X402Handler` in its constructor:

```typescript
// In SwapOrchestrator constructor (addition):
private x402Handler?: X402Handler;

constructor(dex: DexService, signer: Signer, transport?: Transport) {
  // ... existing code ...
  this.x402Handler = new X402Handler(signer);
}
```

The retry logic wraps `dex.getQuote()` and `dex.prepareSwap()`:
```typescript
private async callWithX402Retry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (this.x402Handler && error instanceof Error && this.x402Handler.is402Error(error)) {
      // Parse 402 body from error, create payment proof, retry with headers
      // Implementation depends on transport supporting header injection
      throw new Error('x402 payment flow not yet fully integrated with transport layer');
    }
    throw error;
  }
}
```

> **Note:** Full x402 integration requires the transport layer to support per-request headers. This will be implemented when MCP Server Phase 4 is ready.

**Step 6:** Commit:
```bash
git add packages/sdk/src/x402/
git commit -m "feat(sdk): add x402 payment handler for fee-for-service billing"
```

---

## Phase 5: Plugins (Task 20) -- OUT OF SCOPE

### Task 20: Plugin scaffold

> **OUT OF SCOPE for this implementation cycle.** Placeholder packages created in Task 13. Plugin implementation deferred until SDK core is stable and published.

The plugin packages (`@mangrove-one/openclaw-plugin` and `@mangrove-one/claude-plugin`) will wrap `MangroveClient` for their respective agent frameworks:

- **OpenClaw plugin**: Exposes MangroveClient tools as OpenClaw skills with proper tool definitions, input schemas, and output formatting.
- **Claude plugin**: Wraps MangroveClient as a Claude tool provider, implementing the tool-use protocol for Claude-based agents.

Both plugins will depend on `@mangrove-one/mangrovemarkets` as a peer dependency and provide framework-specific adapters.

---

## Out of Scope: Advanced Agent Mode (Task 21) -- DOCUMENTED ONLY

### Task 21: Document Advanced Agent Mode

> **OUT OF SCOPE.** No implementation in this cycle.

**Files:**
- Create: `/Users/darrahts/Dropbox/alpha-delta/mangrove/MangroveMarkets/packages/sdk/src/agent/README.md`

**Content:** Document the future API surface from the design doc's "Out of Scope" section.

**Capabilities to document:**

1. **Auto-retry with slippage adjustment** -- if swap fails due to slippage, retry with progressively higher tolerance (0.5% -> 1% -> 2%)

2. **Gas-aware execution** -- check gas prices before swapping, queue execution for lower gas if not time-sensitive; configurable gas strategy (fast/medium/slow/custom)

3. **Portfolio-aware routing** -- check balances across all chains, suggest cheapest path (e.g., swap on Arbitrum instead of Ethereum to save gas)

4. **Multi-swap batching** -- rebalance a portfolio in one call: quote multiple swaps, determine optimal execution order, execute sequentially

5. **Stop-loss / take-profit** -- monitor spot prices via polling, execute swap when price crosses a threshold

6. **Event-driven hooks** -- `onSwapConfirmed`, `onApprovalNeeded`, `onGasSpike`, `onPriceAlert` callbacks for agent frameworks that want event-driven architecture

7. **Execution strategies** -- TWAP (time-weighted), VWAP (volume-weighted), iceberg orders for large swaps that should be split across time

**API surface reference (future):**
```typescript
// Portfolio rebalancing
await client.agent.rebalance({
  portfolio: ['0xWallet1', '0xWallet2'],
  targetAllocations: {
    'ETH': 0.5,
    'USDC': 0.3,
    'WBTC': 0.2,
  },
  maxSlippage: 1.0,
  gasStrategy: 'medium',
});

// Price monitoring with automatic execution
await client.agent.watchPrice({
  token: '0xWETH',
  chainId: 8453,
  trigger: { above: 3000 },
  action: {
    type: 'swap',
    params: { src: '0xWETH', dst: '0xUSDC', amount: '1000000000000000000', chainId: 8453 },
  },
});

// Scheduled swap with gas optimization
await client.agent.scheduledSwap({
  params: { src: '0xUSDC', dst: '0xWETH', amount: '5000000000', chainId: 8453 },
  executeAt: '2026-03-01T00:00:00Z',
  gasStrategy: 'slow', // Wait for low gas
  maxGasPrice: '20', // gwei
});

// TWAP execution for large orders
await client.agent.twap({
  params: { src: '0xUSDC', dst: '0xWETH', amount: '50000000000', chainId: 8453 },
  duration: '4h',
  intervals: 8, // Split into 8 equal swaps over 4 hours
  maxSlippagePerInterval: 0.3,
});
```

**Commit:**
```bash
git add packages/sdk/src/agent/README.md
git commit -m "docs(sdk): document Advanced Agent Mode API surface (future)"
```

---

## Summary: Task Index

| Task | Phase | Description | Key Files |
|------|-------|-------------|-----------|
| 1 | 1 | Monorepo scaffold | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` |
| 2 | 1 | SDK package configuration | `packages/sdk/package.json`, `packages/sdk/tsconfig.json`, `vitest.config.ts` |
| 3 | 1 | Core types | `types/dex.ts`, `types/transport.ts`, `types/signer.ts`, `types/config.ts` |
| 4 | 1 | Signer interface re-export | `signer/interface.ts` |
| 5 | 1 | EthersSigner adapter | `signer/ethers.ts` |
| 6 | 1 | Transport interface + MockTransport | `transport/interface.ts`, `transport/__tests__/mock.ts` |
| 7 | 1 | MCP transport | `transport/mcp.ts` |
| 8 | 1 | REST transport | `transport/rest.ts` |
| 9 | 1 | DexService (low-level) | `dex/service.ts`, `dex/types.ts` |
| 10 | 1 | SwapOrchestrator (high-level) | `dex/swap.ts` |
| 11 | 1 | MangroveClient | `client.ts` |
| 12 | 1 | Barrel exports | `index.ts` |
| 13 | 1 | Placeholders + examples | `examples/*.ts`, plugin packages |
| 14 | 2 | OneInch types | `types/oneinch.ts` |
| 15 | 2 | OneInchService -- balance & allowances | `oneinch/index.ts` |
| 16 | 2 | OneInchService -- pricing & tokens | `oneinch/index.ts` |
| 17 | 3 | OneInchService -- portfolio | `oneinch/index.ts`, `types/oneinch.ts` |
| 18 | 3 | OneInchService -- chart & history | `oneinch/index.ts`, `types/oneinch.ts` |
| 19 | 4 | x402 payment handler | `x402/handler.ts`, `x402/types.ts` |
| 20 | 5 | Plugin scaffold (OUT OF SCOPE) | placeholder packages |
| 21 | -- | Advanced Agent Mode (DOCUMENTED ONLY) | `agent/README.md` |

## Build Order

```
Task 8  (REST transport)          -- no dependencies within Part 2
Task 9  (DexService)              -- depends on Task 6 (MockTransport) from Part 1
Task 10 (SwapOrchestrator)        -- depends on Task 9
Task 11 (MangroveClient)          -- depends on Tasks 7, 8, 9, 10
Task 12 (barrel exports)          -- depends on Task 11
Task 13 (placeholders/examples)   -- depends on Task 12
Task 14 (OneInch types)           -- no dependencies within Part 2
Task 15 (OneInchService balance)  -- depends on Task 14
Task 16 (OneInchService pricing)  -- depends on Task 15
Task 17 (OneInchService portfolio)-- depends on Task 16
Task 18 (OneInchService chart)    -- depends on Task 17
Task 19 (x402 handler)            -- depends on Task 11
Task 20 (plugins)                 -- OUT OF SCOPE
Task 21 (agent mode docs)         -- no code dependencies
```
