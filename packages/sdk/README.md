# @mangrove-ai/sdk

TypeScript SDK for [MangroveMarkets](https://mangrovemarkets.com) -- DEX aggregation and agent marketplace.

**Proven on mainnet**: real USDC-to-USDT swap on Base ([block 43280998](https://basescan.org/tx/0x1fe4e3bcf0a30db0a13eaa774d52f41fac164099bcec6fa3dba562dfaaa8b48f)).

## Installation

```bash
npm install @mangrove-ai/sdk ethers
```

`ethers` is an optional peer dependency -- only needed if you use the built-in `EthersSigner`.

## Quick Start

```typescript
import { MangroveClient, EthersSigner } from '@mangrove-ai/sdk';
import { Wallet } from 'ethers';

// 1. Create a signer (private key stays local, never sent to server)
const wallet = new Wallet(process.env.PRIVATE_KEY!);
const signer = new EthersSigner(wallet, [8453]); // Base chain ID

// 2. Connect to MangroveMarkets
const client = new MangroveClient({
  url: 'https://mangrovemarkets.com',
  transport: 'rest',  // or 'mcp' for MCP protocol
  signer,
});
await client.connect();

// 3. Swap tokens (one call handles everything)
const result = await client.dex.swap({
  src: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  dst: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT on Base
  amount: '4000000',  // 4 USDC (6 decimals)
  chainId: 8453,      // Base
  slippage: 1.0,      // 1% max slippage
});

console.log(`Swap confirmed: ${result.txHash}`);
console.log(`Status: ${result.status}`);
console.log(`Gas used: ${result.gasUsed}`);

await client.disconnect();
```

## How It Works

The SDK connects to the MangroveMarkets server, which aggregates DEX liquidity via 1inch across 12 EVM chains. The server returns unsigned transaction calldata -- your private key never leaves the client.

```
Your App --> SDK --> MangroveMarkets Server --> 1inch API
              |
              +--> Local Signing (ethers.js or custom)
```

### Swap Flow

When you call `client.dex.swap()`, the SDK handles the full flow:

1. **Get quote** from the DEX aggregator
2. **Check allowance** -- does the router have permission to spend your tokens?
3. **Approve** (if needed) -- sign and broadcast an ERC-20 approval tx
4. **Prepare swap** -- get unsigned swap calldata from 1inch
5. **Sign locally** -- your private key signs the tx on your machine
6. **Broadcast** -- send the signed tx to the network
7. **Poll** until confirmed or failed

## API Reference

### MangroveClient

```typescript
const client = new MangroveClient({
  url: string;          // Server URL (e.g., 'https://mangrovemarkets.com')
  transport?: string;   // 'mcp' (default) or 'rest'
  signer?: Signer;      // Required for swap operations
  apiKey?: string;      // Optional API key for authenticated endpoints
});

await client.connect();     // Open connection
await client.disconnect();  // Close connection
```

### DexService (`client.dex`)

#### High-Level

```typescript
// Full swap -- handles quote, approve, sign, broadcast, poll
const result = await client.dex.swap({
  src: string;           // Source token address
  dst: string;           // Destination token address
  amount: string;        // Amount in smallest unit (wei)
  chainId: number;       // EVM chain ID
  slippage?: number;     // Max slippage % (default: 0.5)
  mevProtection?: boolean; // Flashbots MEV protection (default: false)
  mode?: 'standard' | 'x402'; // Billing mode (default: 'standard')
});
// Returns: { txHash, chainId, status, gasUsed, inputToken, outputToken, inputAmount, outputAmount }
```

#### Low-Level (Step-by-Step Control)

```typescript
// Get a quote
const quote = await client.dex.getQuote({
  src: '0xUSDC...',
  dst: '0xETH...',
  amount: '1000000',
  chainId: 8453,
});
// Returns: { quoteId, venueId, inputToken, outputToken, inputAmount, outputAmount, ... }

// Get unsigned approval tx (ERC-20 tokens only)
const approveTx = await client.dex.approveToken({
  tokenAddress: '0xUSDC...',
  chainId: 8453,
  walletAddress: '0xYourWallet...',
});
// Returns: { chainId, to, data, value, gas, nonce, maxFeePerGas, ... }

// Get unsigned swap tx
const swapTx = await client.dex.prepareSwap({
  quoteId: quote.quoteId,
  walletAddress: '0xYourWallet...',
  slippage: 1.0,
});
// Returns: { chainId, to, data, value, gas, nonce, maxFeePerGas, ... }

// Sign locally
const signedTx = await signer.signTransaction(swapTx);

// Broadcast
const broadcast = await client.dex.broadcast({
  chainId: 8453,
  signedTx: signedTx,
  mevProtection: false,
});
// Returns: { txHash, chainId, broadcastMethod }

// Poll status
const status = await client.dex.txStatus({
  txHash: broadcast.txHash,
  chainId: 8453,
});
// Returns: { txHash, chainId, status, blockNumber, gasUsed }
```

### Supported Chains

| Chain | ID | Status |
|-------|----|--------|
| Ethereum | 1 | Supported |
| Base | 8453 | Supported (primary, proven) |
| Arbitrum | 42161 | Supported |
| Polygon | 137 | Supported |
| Optimism | 10 | Supported |
| BNB Chain | 56 | Supported |
| Avalanche | 43114 | Supported |
| Gnosis | 100 | Supported |
| zkSync Era | 324 | Supported |
| Linea | 59144 | Supported |

### Transport Options

| Transport | Protocol | Best For |
|-----------|----------|----------|
| `'mcp'` (default) | MCP over Streamable HTTP | AI agents using MCP protocol |
| `'rest'` | REST API over HTTPS | Direct HTTP integration, scripts |

### Custom Signers

The SDK never touches private keys. Implement `Signer` for any signing backend:

```typescript
import type { Signer, UnsignedTransaction } from '@mangrove-ai/sdk';

class MyCustomSigner implements Signer {
  async getAddress(): Promise<string> { /* ... */ }
  async signTransaction(tx: UnsignedTransaction): Promise<string> { /* ... */ }
  async getSupportedChainIds(): Promise<number[]> { /* ... */ }
}
```

Use cases: MPC wallets, hardware wallets (Ledger/Trezor), cloud KMS, custodial signing.

## Security

- Private keys never leave the client -- server returns unsigned calldata only
- HTTPS enforced for non-localhost connections
- Tool names validated to prevent URL injection
- Server error responses detected and thrown (not silently ignored)
- Quote expiry checked before submitting stale quotes
- Failed approvals detected and thrown (not silently continued)

## Examples

See the [examples directory](https://github.com/MangroveTechnologies/MangroveMarkets/tree/main/packages/sdk/examples) for:

- `basic.ts` -- Read-only operations (no signer needed)
- `high-level-swap.ts` -- One-call swap via SwapOrchestrator
- `low-level-swap.ts` -- Step-by-step control over the full flow

## Links

- Server: https://mangrovemarkets.com
- API Docs: https://mangrovemarkets.com/docs (Swagger) / https://mangrovemarkets.com/redoc (ReDoc)
- GitHub: https://github.com/MangroveTechnologies/MangroveMarkets
- Issues: https://github.com/MangroveTechnologies/MangroveMarkets/issues

## License

MIT
