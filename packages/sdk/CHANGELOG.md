# Changelog

All notable changes to the MangroveMarkets SDK will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.0] - Unreleased

### Added
- `client.cex` provides the Kraken OAuth proxy lifecycle: start consent, inspect
  status, read balances, validate/place spot orders, list open orders, and cancel.
- `CexProxyError` retains HTTP status, response headers, response body, and a
  safe message. CEX requests are not automatically retried after ambiguous results.

### Changed
- Wallet creation is local and unfunded. EVM keys require optional `ethers@^6`;
  XRPL keys use the bundled XRPL library. This differs from the published 0.3.0
  artifact, which delegated wallet creation to the server. Treat returned key
  material as a secret and store it in the caller's custody.
- The release candidate includes the post-0.3.0 complete MCP result contract,
  payment/recovery metadata handling, XRPL signer and escrow support present in
  current source. `callToolResult` never retries an unacknowledged write.

### Scope
- The Markets SDK remains distinct from the MangroveAI API clients. The Kraken
  OAuth proxy is not a generic brokerage API and exposes no positions endpoint.

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
