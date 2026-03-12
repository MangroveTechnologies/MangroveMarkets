# Contributing to MangroveMarkets

TypeScript SDK, Claude Plugin, and OpenClaw Plugin for MangroveMarkets -- the open, decentralized marketplace and DEX aggregator for AI agents.

## Prerequisites

- **Node.js 18+**
- **pnpm 8+** (`npm install -g pnpm`)
- **Git**

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MangroveTechnologies/MangroveMarkets.git
   cd MangroveMarkets
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Run tests:**
   ```bash
   pnpm test
   ```

4. **Build all packages:**
   ```bash
   pnpm build
   ```

## Monorepo Structure

```
packages/
  sdk/              # @mangrove-ai/sdk -- TypeScript client library
  claude-plugin/    # Claude Code plugin (planned)
  openclaw-plugin/  # OpenClaw plugin (planned)
  website/          # mangrovemarkets.com marketing site
```

## Branch Naming

Use `<type>/<short-description>`:

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `refactor` | Code restructuring without behavior change |
| `test` | Adding or updating tests |
| `chore` | Maintenance, tooling, CI, dependencies |

Examples: `feat/sdk-marketplace-client`, `fix/transport-timeout`, `docs/sdk-readme`

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <description>
```

Scopes: `sdk`, `plugin`, `website`, `docs`

Examples:
- `feat(sdk): add marketplace client service`
- `fix(sdk): handle transport disconnect gracefully`
- `test(sdk): add SwapOrchestrator approval flow tests`

Imperative mood. Keep the first line under 72 characters.

## Code Style

- **TypeScript** with strict mode
- **ESM modules** (type: "module" in package.json)
- **vitest** for testing
- **JSDoc** on all exported classes, interfaces, and public methods
- **Google-style JSDoc** with @param and @returns tags

## Pull Request Process

1. Create a branch from `main`.
2. Write tests for new functionality.
3. Open a PR with a clear description.
4. All tests must pass before merge.

## AI Agent Contributors

Read [AGENTS.md](AGENTS.md) for agent-specific context and architectural guidelines.
