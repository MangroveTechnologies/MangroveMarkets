# MangroveMarkets SDK capability matrix

Release candidate reviewed against the public Markets server source at
`MangroveMarkets-MCP-Server` main revision
`c3c2c32422a0b896bb0aa06f918367c353a8ca64`. This is a Markets product contract;
it does not describe MangroveAI strategy or backtesting APIs.

## Supported client surface

| Capability | Python (`mangrove_markets`) | TypeScript (`@mangrove-ai/markets` 0.4.0) | Contract and limits |
| --- | --- | --- | --- |
| MCP tool calls | `call_tool()` and `call_tool_result()` | `callTool()` and `callToolResult()` | Full result mode preserves content, structured data, tool errors, metadata, and response headers when the server supports `mcp-v1`. Legacy methods retain their existing success return shapes. |
| DEX | `client.dex` | `client.dex` | Quote, prepare, approval, broadcast, status, and high-level swap workflows available in current source. Swaps require caller-side signing. |
| Wallet | `client.wallet` | `client.wallet` | Key creation occurs locally and does not fund a wallet. Python includes XRPL support; TypeScript includes XRPL and escrow support from current source. These additions are not in the older published npm artifact. |
| Marketplace methods (under construction) | `client.marketplace` methods exist | `client.marketplace` methods exist | Marketplace products, listings, offers and escrow are under construction; client methods or published schemas do not establish workflow availability. |
| Kraken OAuth connect | `client.cex.connect_start(mode=...)` | `client.cex.connectStart(mode)` | `POST /api/v1/exchanges/kraken/connect`. Returns a consent URL/state; the user completes browser consent. Modes are `view` or `execute`. |
| Kraken connection status | `client.cex.status()` | `client.cex.status()` | `GET /api/v1/exchanges/kraken/status`. Caller polls after consent. |
| Kraken balances | `client.cex.balances()` | `client.cex.balances()` | `GET /api/v1/exchanges/kraken/balances`. Uses the platform-held OAuth grant. |
| Validate/place spot order | `client.cex.place_order(..., validate_only=True)` | `client.cex.placeOrder({ ..., validateOnly: true })` | `POST /api/v1/exchanges/kraken/orders`. Validation-only asks the venue to validate without placing. Actual placement requires execute access and remains an externally visible action. |
| Open orders | `client.cex.open_orders()` | `client.cex.openOrders()` | `GET /api/v1/exchanges/kraken/orders`. Returns open orders only. |
| Cancel order | `client.cex.cancel_order(tx_id)` | `client.cex.cancelOrder(txId)` | `DELETE /api/v1/exchanges/kraken/orders/{tx_id}`. |
| Broker positions | Not available | Not available | The reviewed Kraken OAuth router has no positions route. Mangrove strategy execution records are not broker account positions. |

## Credential and risk ownership

The CEX proxy uses the Mangrove API key as the caller credential. It does not
accept a Kraken key or caller-supplied user ID. The platform holds the OAuth
grant and derives the account identity. The separate local BYOK agent workflow
has different credential custody and a narrower OAuth route surface; do not
describe it as the hosted SDK flow.

The SDK submits a requested operation and preserves Mangrove's response or
error. Mangrove owns deterministic risk management based on live market and
account conditions. The SDK and agent do not implement or execute that policy.
Neither client retries a CEX request automatically: after a timeout or ambiguous
server failure, inspect connection/order state before deciding what to request.

## Current product identities: November 1, 2026 (America/Chicago)

- **Markets Python:** [`mangrovemarkets` 1.1.1](https://pypi.org/project/mangrovemarkets/1.1.1/) is published; import `mangrove_markets`.
- **Markets TypeScript:** `@mangrove-ai/markets` 0.4.0 is the renamed source candidate, not yet a verified registry release. It retains the 0.4.0 workflow implementation above.
- **Legacy npm history:** published `@mangrove-ai/sdk` versions 0.1.2, 0.2.0 and 0.3.0 are Markets artifacts. They are not rewritten. The older 0.3.0 hosted-wallet path lacks the 0.4.0 Kraken OAuth, full-result and local-wallet additions.
- **Separate AI product:** [`mangroveai` 2.1.0](https://pypi.org/project/mangroveai/2.1.0/) is published. The separate TypeScript client becomes `@mangrove-ai/sdk` 1.0.0 in [MangroveAI-SDK source](https://github.com/MangroveTechnologies/MangroveAI-SDK/tree/main/packages/typescript); it is not a compatible upgrade of legacy Markets 0.x.
- **Plugins:** the Markets Claude and OpenClaw workspace packages stay private and unpublished, with dependencies/imports updated to `@mangrove-ai/markets`. Source methods and schemas do not prove hosted marketplace availability or funded live acceptance.

See the [migration and ordered publication plan](npm-product-migration.md).
Markets publication must be verified before AI 1.0.0 takes the old name's `latest`
tag; deprecation is prepared only for the three exact legacy versions.

The following October 30 record is preserved as historical build evidence. Its
publication and consumer-pin statements describe that audit, not current status.

## Artifact provenance (October 30 history)

| Distribution | Last published artifact checked in the October 30 audit | Source value before this change | Local release candidate |
| --- | --- | --- | --- |
| npm `@mangrove-ai/sdk` | `0.3.0` | `0.3.0` | `0.4.0` |
| PyPI `mangrovemarkets` | `1.1.0` | `1.0.2` | `1.1.1` |

The Python release workflow's latest tag is `python-sdk-v1.1.0`; the candidate
source, project metadata, changelog, and `_version.py` are aligned at `1.1.1`.
The npm candidate uses package metadata and changelog version `0.4.0`. These are
local build candidates only. No registry artifact, release tag, or consumer pin
was changed during this work. A release is complete only after publication and
registry readback confirm these exact versions and contents.

## Source and validation scope

The pinned server source exposes the Kraken OAuth routes listed above and does
not expose a broker positions route. The local tests exercise request methods,
paths, auth placement, consent/status/balances/order/cancel sequencing, error
body/header preservation, and no-replay behavior with isolated fixtures. They
do not make a live order, authenticate to a production account, or prove any
live deployment state.
