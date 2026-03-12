# @mangrovemarkets/sdk

TypeScript SDK for MangroveMarkets -- DEX aggregation and agent marketplace with pluggable signing.

## Installation

```bash
pnpm add @mangrovemarkets/sdk
# or
npm install @mangrovemarkets/sdk
```

## Quick Start

```typescript
import { MangroveClient, EthersSigner } from '@mangrovemarkets/sdk';
import { Wallet } from 'ethers';

const wallet = new Wallet(process.env.PRIVATE_KEY!);
const signer = new EthersSigner(wallet, [8453]); // Base chain

const client = new MangroveClient({
  url: 'https://mangrovemarkets.com',
  signer,
  transport: 'mcp', // or 'rest'
});

await client.connect();

// High-level: one-call swap
const result = await client.dex.swap({
  src: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
  dst: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
  amount: '1000000', // 1 USDC
  chainId: 8453,
  slippage: 0.5,
});

console.log('Swap confirmed:', result.txHash);
await client.disconnect();
```

## Architecture

```
MangroveClient
  |-- transport (MCP or REST)
  |-- dex (DexService + SwapOrchestrator)
  |-- oneinch (OneInchService)
  |-- signer (pluggable, never sees private keys)
```

### Two API Levels

**High-level** -- one call does everything:
```typescript
const result = await client.dex.swap({ src, dst, amount, chainId });
// Handles: quote -> approve -> sign -> broadcast -> poll
```

**Low-level** -- step-by-step control:
```typescript
const quote = await client.dex.getQuote({ src, dst, amount, chainId });
const approveTx = await client.dex.approveToken({ tokenAddress, chainId });
const signed = await signer.signTransaction(approveTx);
await client.dex.broadcast({ chainId, signedTx: signed });
```

### Transport Options

| Transport | Protocol | Use Case |
|-----------|----------|----------|
| `mcp` (default) | MCP over Streamable HTTP | AI agents via MCP |
| `rest` | REST API (FastAPI) | Direct HTTP integration |

### Signer Interface

The SDK never sees private keys. Implement the `Signer` interface:

```typescript
interface Signer {
  getAddress(): Promise<string>;
  signTransaction(tx: UnsignedTransaction): Promise<string>;
  getSupportedChainIds(): Promise<number[]>;
}
```

Built-in: `EthersSigner` wraps an ethers.js Wallet. Bring your own for MPC wallets, hardware wallets, or custom signing.

## Services

| Service | Methods |
|---------|---------|
| `client.dex` | getQuote, prepareSwap, approveToken, broadcast, txStatus, swap |
| `client.oneinch` | getBalances, getAllowances, getSpotPrice, getGasPrice, searchTokens, getTokenInfo, getPortfolioValue, getPortfolioPnl, getPortfolioTokens, getPortfolioDefi, getChart, getHistory |

## Security

- No tool accepts private keys -- the server returns unsigned calldata
- Signing happens locally via the Signer interface
- The SDK itself never stores or transmits secrets

## License

MIT
