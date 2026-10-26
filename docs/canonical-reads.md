# Canonical Markets reads

The seventeen `mangrove/markets` reads execute on MangroveMarkets-MCP-Server.
Native MCP and REST (`POST /api/v1/tools/{name}`) use the same dispatch boundary.
The agent discovers the remote schemas and uses its existing wallet payer.
The TypeScript and Python SDKs are transport clients; they do not implement
provider reads, sign payments automatically, or create a payment journal.
Michael is deferred.

API-key calls retain their existing scopes. The new reads do not consume the
marketplace-search quota counter. Wallet calls cost $0.01 USDC per successful
read, using the server's existing paid-read verification, prepare-before-settle
and durable recovery flow. A read payment does not authorize a trade.

## SDK payment transport

Use `callToolResult(name, arguments, {meta})` in TypeScript or
`call_tool_result(name, arguments, meta=meta)` in Python. The supported REST
metadata namespaces are `x402/payment`, `mangrove/payment` and `mangrove/quota`.
MCP transports pass metadata directly. REST transports encode payment headers;
business arguments stay separate. Full acknowledged HTTP error envelopes,
including 402 challenges, remain available in the returned result with their
status, headers and metadata. Ordinary unacknowledged HTTP failures still raise.

An existing caller-owned payer must validate the challenge, obtain spending
approval and persist its signed proof, operation ID and recovery token before
sending them. Recovery resends that same operation and proof; these SDK methods
never sign a replacement or automatically retry. Do not attach an API key when
intending a new wallet-paid operation. Server credential failures are not
permission to fall back to wallet payment.

Python `dex.chart()` now preserves the server's `chart` value series, and
`portfolio.history()` preserves its `history` event envelope. Legacy candle and
transaction-list responses remain readable; current server data no longer
silently becomes an empty list. These are presentation adapters only.

## Validation

Regression coverage was added for payment metadata, 402 envelopes, canonical
chart/history envelopes and no automatic retry. These changes have not been run
by the implementation agent. SDK releases and deployed end-to-end acceptance
remain outstanding.
