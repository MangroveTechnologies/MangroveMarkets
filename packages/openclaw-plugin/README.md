# @mangrovemarkets/openclaw-plugin

OpenClaw plugin for MangroveMarkets. Exposes DEX aggregation, marketplace, wallet, and portfolio tools to OpenClaw agents, with agent hooks and dashboard components.

## Tools

| Tool | Description |
|------|-------------|
| `mangrove_dex_quote` | Get a swap quote from the best available DEX venue |
| `mangrove_dex_swap` | Execute a token swap with local signing |
| `mangrove_dex_status` | Check the status of a pending transaction |
| `mangrove_marketplace_search` | Search marketplace listings |
| `mangrove_marketplace_get` | Get details for a specific listing |
| `mangrove_marketplace_create` | Create a new marketplace listing |
| `mangrove_wallet_info` | Get chain configuration info |
| `mangrove_wallet_create` | Create a new wallet |
| `mangrove_wallet_balance` | Check wallet balance |
| `mangrove_portfolio_value` | Get total portfolio value across chains |
| `mangrove_portfolio_pnl` | Get portfolio profit and loss |
| `mangrove_portfolio_balances` | Get token balances for a wallet |

## Agent Hooks

| Hook | Description |
|------|-------------|
| `onAgentCall` | Logs agent tool invocations for analytics and context enrichment |
| `onTaskComplete` | Refreshes dashboard data and notifies on marketplace/swap completions |

## Dashboard Components

Stub components for the OpenClaw dashboard UI:

- **MarketplaceBrowser** -- Filterable listing grid with buy/sell actions
- **SwapWidget** -- Token selector, quote preview, and swap execution
- **WalletView** -- Per-chain balances and wallet creation
- **PortfolioView** -- Total value, chain breakdown, and PnL chart

## Configuration

Defined in `openclaw.plugin.json`:

| Field | Description |
|-------|-------------|
| `mcpServerUrl` | MangroveMarkets MCP server URL |
| `apiKey` | Optional API key for authenticated endpoints |
| `defaultNetwork` | Default network (e.g., `testnet`, `mainnet`) |

## Architecture

This plugin is a thin wrapper around `@mangrove-ai/sdk`. Tool handlers delegate to SDK client methods or `transport.callTool()` calls. No business logic lives in the plugin layer -- all transport, signing, and API orchestration is handled by the SDK.

The DEX tools use `MangroveClient.dex.*` methods directly. Marketplace, wallet, and portfolio tools use `transport.callTool()` since those SDK services are not yet implemented.

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Lint
pnpm lint
```

## Project Structure

```
src/
  tools/
    dex.ts              # DEX tool handlers (quote, swap, status)
    marketplace.ts      # Marketplace tool handlers (search, get, create)
    wallet.ts           # Wallet tool handlers (info, create, balance)
    portfolio.ts        # Portfolio tool handlers (value, pnl, balances)
  handlers/
    agentCall.ts        # onAgentCall hook
    taskComplete.ts     # onTaskComplete hook
  components/
    MarketplaceBrowser.ts
    SwapWidget.ts
    WalletView.ts
    PortfolioView.ts
  lib/
    client.ts           # MangroveClient singleton initialization
    config.ts           # OpenClaw plugin configuration types
  index.ts              # Plugin entry point
```

## License

MIT
