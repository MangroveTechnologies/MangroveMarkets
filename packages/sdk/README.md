# MangroveMarkets TypeScript SDK (`@mangrove-ai/sdk`)

TypeScript SDK for [MangroveMarkets](https://mangrovemarkets.com) -- DEX aggregation and wallet workflows; marketplace products are under construction.

Package identity: `@mangrove-ai/sdk` is the **Markets** client. For MangroveAI
strategy/backtesting APIs, use the [separate MangroveAI SDKs](https://github.com/MangroveTechnologies/MangroveAI-SDK)
(Python package `mangroveai`; TypeScript package `@mangrove-ai/client`).

Historical Base swap evidence: [prior USDC-to-USDT transaction](https://basescan.org/tx/0x1fe4e3bcf0a30db0a13eaa774d52f41fac164099bcec6fa3dba562dfaaa8b48f).
That record does not validate the current build or establish funded acceptance
for this release.

## Version 0.4.0 workflow matrix

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

### Kraken OAuth lifecycle (0.4.0)

Configure a Mangrove API key, request `view` access for read-only account access
or `execute` access when order placement is needed, then open the returned
`authorizeUrl` for the user. Poll `client.cex.status()` after consent and read
balances. Use `validateOnly: true` before requesting a live order. Mangrove holds
the OAuth grant; this API does not accept a caller-supplied Kraken key or user ID.
The available account surface has no positions method.

```typescript
import { MangroveClient } from '@mangrove-ai/sdk';

const apiOrigin = process.env.MANGROVE_BASE_URL;
const apiKey = process.env.MANGROVE_API_KEY;
if (!apiOrigin || !apiKey) throw new Error('Set MANGROVE_BASE_URL and MANGROVE_API_KEY');

const client = new MangroveClient({ url: apiOrigin, apiKey });
const consent = await client.cex.connectStart('view');
console.log(consent.authorize_url); // show/open this URL for the account owner
const status = await client.cex.status(); // poll after consent
const balances = await client.cex.balances();
```

## Installation

Install a published Markets SDK release:

```bash
npm install @mangrove-ai/sdk ethers
```

Check the installed/published version before using version 0.4.0 features:

```bash
npm view @mangrove-ai/sdk version
```

**Historical registry checkpoint - November 1, 2026 (America/Chicago):** npm
reported 0.3.0, while this checkout's 0.4.0 candidate was not yet published.
Version 0.3.0 uses the hosted-wallet path and lacks the 0.4.0 Kraken OAuth,
full-result and local-wallet additions. See the [release matrix](../../docs/markets-sdk-capability-matrix.md).
Until a 0.4.0 registry release is verified, use a reviewed local 0.4.0 tarball
for the 0.4.0 examples, rather than assuming the registry install contains them:

```bash
npm install /absolute/path/to/mangrove-ai-sdk-0.4.0.tgz ethers
```

Build and pack that tarball from the reviewed checkout using the repository's
[development instructions](../../README.md#development). A local tarball is not
a registry publication or live deployment.

`ethers` is an optional peer dependency -- only needed if you use the built-in `EthersSigner`.

## Version 0.4.0 quick start

```typescript
import { MangroveClient, EthersSigner } from '@mangrove-ai/sdk';
import { Wallet } from 'ethers';

// 1. Create a signer (private key stays local, never sent to server)
const wallet = new Wallet(process.env.PRIVATE_KEY!);
const signer = new EthersSigner(wallet, [8453]); // Base chain ID

// 2. Connect to MangroveMarkets using the origin configured for this deployment
const marketsApiOrigin = process.env.MANGROVE_BASE_URL;
if (!marketsApiOrigin) throw new Error('Set MANGROVE_BASE_URL to your deployment-owner-confirmed API origin');
const client = new MangroveClient({
  url: marketsApiOrigin,
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
  url: string;          // Explicit origin confirmed for your Markets deployment
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
| Base | 8453 | Supported (primary) |
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

- Server: use the API origin confirmed for your Markets deployment.
- API docs: consult the schema and API documentation exposed by that deployment.
- GitHub: https://github.com/MangroveTechnologies/MangroveMarkets
- Issues: https://github.com/MangroveTechnologies/MangroveMarkets/issues

## License

MIT

## Complete responses and local wallet creation (0.4.0)

`client.callToolResult(name, arguments)` preserves MCP content, structured data,
error flags and metadata. REST requires a server supporting the `mcp-v1` result
format. Existing business methods retain their successful return shapes.

`client.wallet.create()` generates an **unfunded local** XRPL wallet; EVM creation
uses optional `ethers@^6`. It never calls hosted `wallet_create`. Funding is separate.
Never log or transmit the returned secret material.

See [the response contract and migration notes](../../docs/t17-client-results.md).
