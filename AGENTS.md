# AGENTS.md

> For the full agent system documentation, see `mangrove/.claude/AGENT-SYSTEM.md`.
>
> This file covers repo-specific agent conventions for MangroveMarkets (TypeScript SDK and plugins). It supplements (not replaces) the centralized system.

## Project Overview

MangroveMarkets is an open, decentralized marketplace built for AI agents -- not humans. Agents are the first-class participants. They buy, sell, and trade information, compute, digital resources, and crypto assets through MangroveMarkets.

## File Conventions

- No all-caps markdown filenames except `README.md` and `CLAUDE.md` and this file (`AGENTS.md`)
- There is only ever one `AGENTS.md`, and it lives in the project root
- Documentation lives in `docs/`
- TypeScript files use `camelCase.ts`; non-code files use `lowercase-hyphens`
- See `docs/conventions.md` for full coding conventions

## Architecture -- Two Distinct Products

### 1. The Mangrove Marketplace
An agent-to-agent marketplace (like eBay for agents) where agents list, discover, and transact digital goods and services. Settlement is in XRP on the XRPL. Mangrove facilitates discovery, escrow, and delivery -- not execution.

### 2. The Mangrove DEX Aggregator
A unified interface for agents to trade crypto across multiple decentralized exchanges -- 1inch (EVM), XPMarket (XRPL), Jupiter (Solana). Mangrove is not the execution venue -- it routes to the right DEX and provides a single clean interface.

## Delivery Mechanism

MangroveMarkets is delivered to agents as:
- An **MCP server** (the protocol interface)
- **Skills and tools** (actionable capabilities agents invoke via MCP tool calls)

## Key Principles

- Agents are the users, not humans
- Open marketplace -- no gatekeeping
- Money (XRP, crypto) is a means to an end, not the end itself
- Mangrove does not sit in the middle of external integrations (Akash, Fetch.ai, etc.) -- it provides tools for agents to access those services directly
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
- Integration tools (Akash, Fetch.ai, Bittensor, Nodes.ai): Free -- drives adoption

## Project Structure

```
packages/
  sdk/                 # @mangrove-ai/sdk -- TypeScript client library
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
.claude/agents/        # Product owner only (domain agents are centralized)
```

## Domain Ownership

Agent definitions live at `mangrove/.claude/agents/`. Each domain has a specialist agent. To delegate work, read the agent definition file and spawn a `general-purpose` sub-agent with the spec as context. See `mangrove/.claude/AGENT-SYSTEM.md` for the full delegation pattern.

This is a TypeScript SDK repo. The domain agents below map to SDK service modules:

| Agent | Definition | Owned Files | Can Read (not modify) |
|-------|-----------|-------------|----------------------|
| marketplace | `mangrove/.claude/agents/domain/marketplace.md` | `packages/sdk/src/marketplace/`, `packages/sdk/tests/marketplace/` | `packages/sdk/src/types/`, `packages/sdk/src/client/` |
| dex | `mangrove/.claude/agents/domain/dex.md` | `packages/sdk/src/dex/`, `packages/sdk/src/oneinch/`, `packages/sdk/tests/dex/` | `packages/sdk/src/types/`, `packages/sdk/src/client/` |
| wallet | `mangrove/.claude/agents/domain/wallet.md` | `packages/sdk/src/wallet/`, `packages/sdk/src/signer/`, `packages/sdk/tests/wallet/` | `packages/sdk/src/types/` |
| frontend-developer | `mangrove/.claude/agents/frontend-developer.md` | `packages/website/`, `packages/claude-plugin/`, `packages/openclaw-plugin/` | `docs/`, `packages/sdk/src/types/` |
| devops-engineer | `mangrove/.claude/agents/devops-engineer.md` | `Dockerfile`, `docker-compose.yml`, `.github/workflows/` | `packages/` (read-only) |
| test-engineer | `mangrove/.claude/agents/test-engineer.md` | `packages/sdk/tests/`, test configs | All `packages/sdk/src/` (read-only) |
| code-review | `mangrove/.claude/agents/code-review.md` | None (read-only reviewer, may update `.claude/rules/`) | All `packages/`, `docs/`, `.claude/` |

## How to Delegate Work

The 2-step delegation pattern (see `mangrove/.claude/AGENT-SYSTEM.md` for details):

1. **Read the agent definition** from `mangrove/.claude/agents/`
2. **Spawn a `general-purpose` sub-agent** with the definition as context

```
# Example: delegate DEX SDK work
agent_spec = Read("mangrove/.claude/agents/domain/dex.md")

Agent(subagent_type="general-purpose", prompt="""
  {agent_spec}
  Working directory: MangroveMarkets/
  Task: Implement the SwapOrchestrator in packages/sdk/src/dex/.
  Read CLAUDE.md for project conventions before starting.
""")
```

Claude Code supports three built-in subagent_types: `general-purpose`, `Explore`, `Plan`. Custom names in agent frontmatter are metadata, not registrations.

## Rules for Domain Development

1. **Stay in your domain.** Only modify files you own. Read dependencies, don't edit them.
2. **Contract-first.** Define types in `packages/sdk/src/types/` before implementing services.
3. **Write tests.** Tests mirror source structure. Use vitest. Mock external dependencies.
4. **Don't over-engineer.** Start simple. Build iteratively.

## Key Documents

| Document | Purpose |
|----------|---------|
| `docs/vision.md` | WHY -- the product vision |
| `docs/specification.md` | WHAT -- detailed product spec |
| `docs/implementation-plan.md` | HOW -- phased build plan |
| `docs/conventions.md` | STYLE -- coding conventions |
| `CONTRIBUTING.md` | PROCESS -- how to contribute |

## Do Not Modify

- `openclaw/` -- separate repository, never touch
