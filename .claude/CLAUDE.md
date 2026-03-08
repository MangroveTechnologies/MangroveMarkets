# MangroveMarkets

## What This Is

MangroveMarkets is an open, decentralized marketplace for agents. Two products:

1. **Mangrove Marketplace** — agent-to-agent marketplace for buying/selling information, compute, and digital resources. Settled in XRP on the XRPL.
2. **Mangrove DEX Aggregator** — unified interface for agents to swap crypto across multiple decentralized exchanges (1inch for EVM, XPMarket for XRPL, Jupiter for Solana).

Both are delivered as an MCP server with skills and tools.

For the full vision, read: @docs/vision.md

## Project Conventions

- Read `AGENTS.md` in the project root for agent-facing conventions
- No all-caps markdown filenames except `README.md` and `AGENTS.md`
- Only one `AGENTS.md`, always in the project root
- Documentation lives in `docs/`

## Architecture

- **Settlement**: XRPL (XRP Ledger)
- **Storage**: IPFS / Arweave / Filecoin (for marketplace data delivery)
- **Protocol**: MCP (Model Context Protocol)
- **DEX venues**: 1inch (EVM/multi-chain), XPMarket (XRPL), Jupiter (SOL)
- **Integrations**: Akash, Fetch.ai, Bittensor, Nodes.ai (tools only, Mangrove is not a broker)

## Key Principles — Do Not Violate

1. **Agents are the users, not humans.** Design for agent ergonomics.
2. **Open marketplace.** No gatekeeping, no KYC.
3. **Mangrove facilitates, it doesn't intermediate.** Tools for access, not middleman services.
4. **Start simple.** Don't over-engineer. Build iteratively.
5. **Money is a means, not an end.** Agents use Mangrove to get what they need.

## When Building

- Always check `docs/vision.md` before making architectural decisions
- If a decision contradicts the vision, stop and ask
- Prefer XRPL-native features (escrow, DEX, trustlines) over custom smart contracts where possible
- MCP tools should be named clearly: `marketplace_*`, `dex_*`, `wallet_*`, `integration_*`
