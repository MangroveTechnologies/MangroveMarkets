# AGENTS.md

> This file defines the conventions, guidelines, and context for any AI agent working on the MangroveMarkets project.

## Project Overview

MangroveMarkets is an open, decentralized marketplace built for AI agents — not humans. Agents are the first-class participants. They buy, sell, and trade information, compute, digital resources, and crypto assets through MangroveMarkets.

## File Conventions

- No all-caps markdown filenames except `README.md` and `CLAUDE.md` and this file (`AGENTS.md`)
- There is only ever one `AGENTS.md`, and it lives in the project root
- Documentation lives in `docs/`
- TypeScript files use `camelCase.ts`; non-code files use `lowercase-hyphens`
- See `docs/conventions.md` for full coding conventions

## Architecture — Two Distinct Products

### 1. The Mangrove Marketplace
An agent-to-agent marketplace (like eBay for agents) where agents list, discover, and transact digital goods and services. Settlement is in XRP on the XRPL. Mangrove facilitates discovery, escrow, and delivery — not execution.

### 2. The Mangrove DEX Aggregator
A unified interface for agents to trade crypto across multiple decentralized exchanges -- 1inch (EVM), XPMarket (XRPL), Jupiter (Solana). Mangrove is not the execution venue -- it routes to the right DEX and provides a single clean interface.

## Delivery Mechanism

MangroveMarkets is delivered to agents as:
- An **MCP server** (the protocol interface)
- **Skills and tools** (actionable capabilities agents invoke via MCP tool calls)

## Key Principles

- Agents are the users, not humans
- Open marketplace — no gatekeeping
- Money (XRP, crypto) is a means to an end, not the end itself
- Mangrove does not sit in the middle of external integrations (Akash, Fetch.ai, etc.) — it provides tools for agents to access those services directly
- Start simple, build iteratively

## Tech Stack

- **Language**: TypeScript (strict mode, ESM)
- **Runtime**: Node.js 18+
- **Package manager**: pnpm 8+ (monorepo with workspaces)
- **Testing**: vitest
- **Build**: tsup / tsc
- **Server SDK consumed**: MangroveMarkets-MCP-Server (Python, FastAPI, FastMCP)
- **Transports**: MCP over Streamable HTTP, REST (FastAPI)
- **Settlement layer**: XRPL (XRP Ledger), x402 (EVM)
- **DEX venues**: 1inch (EVM), XPMarket (XRPL), Jupiter (Solana)

## Revenue Model

- Thin transaction fee on marketplace escrow settlements
- Routing fee on DEX aggregator swaps
- Market intelligence: 10 XRP per 500 tool calls (with a free teaser tier)
- Integration tools (Akash, Fetch.ai, Bittensor, Nodes.ai): Free — drives adoption

## Project Structure

```
packages/
  sdk/                 # @mangrovemarkets/sdk -- TypeScript client library
    src/
      client/          # MangroveClient, transport layer (MCP + REST)
      dex/             # DexService, SwapOrchestrator
      oneinch/         # OneInchService (1inch API wrapper)
      marketplace/     # MarketplaceService (listings, offers, escrow)
      wallet/          # WalletService (chain-agnostic)
      signer/          # Signer interface + EthersSigner
      types/           # Shared TypeScript types
    tests/             # vitest tests mirroring src/
  claude-plugin/       # Claude Code plugin (planned)
  openclaw-plugin/     # OpenClaw plugin (planned)
  website/             # mangrovemarkets.com marketing site
docs/                  # Vision, specification, SDK design
.claude/agents/        # Subagent definitions
```

## Development with Subagents

MangroveMarkets is designed for parallel development using Claude Code subagents. Each domain has a specialist agent defined in `.claude/agents/`.

### Domain Ownership

| Agent | Domain | Owned Files | Can Read (not modify) |
|-------|--------|-------------|----------------------|
| marketplace-agent | Marketplace | `src/marketplace/`, `tests/marketplace/` | `src/shared/`, `src/mcp/errors.py` |
| dex-agent | DEX Aggregator | `src/dex/`, `tests/dex/` | `src/shared/`, `src/mcp/errors.py` |
| wallet-agent | Wallet | `src/wallet/`, `tests/wallet/` | `src/shared/` |
| mcp-agent | MCP Server | `src/mcp/` | All domain `tools.py` files |
| metrics-agent | Metrics | `src/metrics/`, `tests/metrics/` | `src/shared/`, marketplace data |
| infra-agent | Infrastructure | `Dockerfile`, `docker-compose.yml`, `infra/`, `.github/workflows/` | `src/` (read-only) |
| shared-agent | Shared Utils | `src/shared/`, `tests/shared/` | All domain `models.py` files |
| ui-agent | Frontend/UI | `src/static/`, `src/templates/`, `src/frontend/`, `tests/frontend/` | `docs/brand-guidelines.md`, `src/app.py`, `src/shared/config/` |
| integration-agent | Integrations | `src/integrations/`, `tests/integrations/` | `src/shared/`, `src/mcp/errors.py`, `docs/specification.md` |
| qa-agent | QA & E2E Testing | `tests/conftest.py`, `tests/e2e/`, `tests/integration/`, `tests/fixtures/` | All `src/` and `tests/` (read-only) |
| code-review-agent | Code Review | None (read-only reviewer, may update `.claude/rules/`) | All `src/`, `tests/`, `docs/`, `.claude/` |

### Rules for Subagent Development

1. **Stay in your domain.** Only modify files you own. Read dependencies, don't edit them.
2. **Contract-first.** Define `models.py` (Pydantic contracts) before implementing `service.py` or `tools.py`.
3. **Export a register function.** Each domain's `tools.py` exports a `register(server: FastMCP)` function that adds prefixed tools to the main server.
4. **Use structured errors.** Import `tool_error` from `src/mcp/errors.py` for all error responses.
5. **Write tests.** Tests mirror source structure. Use pytest. Mock external dependencies.
6. **Don't over-engineer.** Start simple. In-memory stores before databases. Stubs before full implementations.

### How to Invoke a Subagent

When working on a specific domain, reference the agent definition file for context:
```
Read .claude/agents/marketplace-agent.md for domain context, then work on src/marketplace/
```

### Implementation Phases

See `docs/implementation-plan.md` for the phased build plan with subagent assignments per phase.

## Key Documents

| Document | Purpose |
|----------|---------|
| `docs/vision.md` | WHY — the product vision |
| `docs/specification.md` | WHAT — detailed product spec |
| `docs/implementation-plan.md` | HOW — phased build plan |
| `docs/conventions.md` | STYLE — coding conventions |
| `CONTRIBUTING.md` | PROCESS — how to contribute |

## Do Not Modify

- `openclaw/` — separate repository, never touch
