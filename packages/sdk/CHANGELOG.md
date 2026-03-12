# Changelog

All notable changes to the MangroveMarkets SDK will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-03-12

### Added
- MangroveClient with pluggable transport (MCP + REST)
- DexService for low-level DEX operations (getQuote, prepareSwap, approveToken, broadcast, txStatus)
- SwapOrchestrator for high-level swap execution (quote -> approve -> sign -> broadcast -> poll)
- OneInchService for 1inch API operations (balances, allowances, spot prices, gas, tokens, portfolio, charts, history)
- EthersSigner adapter for ethers.js v6
- McpTransport for MCP Streamable HTTP connections
- RestTransport for REST API connections
- Full TypeScript type definitions
- JSDoc on all public APIs
- 64 unit tests (vitest)
- 17 e2e integration tests against live server
- 3 usage examples (basic, high-level swap, low-level swap)
