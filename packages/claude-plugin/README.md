# @mangrovemarkets/claude-plugin

Claude Code plugin for MangroveMarkets. Provides skills and commands for interacting with the MangroveMarkets MCP server -- DEX aggregation, marketplace, wallet management, and portfolio tracking.

## Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| Swap | `/swap` | Get quotes, execute swaps, and check transaction status across DEX venues |
| Marketplace | `/marketplace` | Search listings, get listing details, and create new listings |
| Wallet | `/wallet` | Get chain info, create wallets, and check balances |
| Portfolio | `/portfolio` | View portfolio value, PnL, and token balances across chains |

## Commands

| Command | Description |
|---------|-------------|
| `/mangrove-status` | Show MCP server connection status (URL, transport, connected state) |
| `/mangrove-connect` | Connect or reconnect to a MangroveMarkets MCP server |

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MANGROVE_MCP_URL` | `http://localhost:8080` | MCP server URL |
| `MANGROVE_TRANSPORT` | `mcp` | Transport protocol (`mcp` or `rest`) |
| `MANGROVE_API_KEY` | (none) | Optional API key for authenticated endpoints |

## Architecture

This plugin is a thin wrapper around `@mangrovemarkets/sdk`. It translates Claude Code skill/command invocations into SDK client calls. No business logic lives here -- all transport, signing, and API orchestration is handled by the SDK.

The swap skill uses `MangroveClient.dex.*` methods from the SDK directly. The marketplace, wallet, and portfolio skills use `transport.callTool()` directly since those SDK services are not yet implemented.

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
  skills/
    swap.ts           # /swap skill -- quote, execute, status
    marketplace.ts    # /marketplace skill -- search, get, create
    wallet.ts         # /wallet skill -- info, create, balance
    portfolio.ts      # /portfolio skill -- value, pnl, balances
  commands/
    status.ts         # /mangrove-status command
    connect.ts        # /mangrove-connect command
  config.ts           # Configuration loading from env vars
  index.ts            # Plugin entry point
```

## License

MIT
