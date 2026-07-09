# CEX OAuth proxy: agent trading through platform-custodied Kraken grants

*Design record, 2026-07-09. Grounding survey with verified references: [`docs/research/oauth-proxied-cex-custody.md`](research/oauth-proxied-cex-custody.md). Companion (not superseded) design: BYOK + trade telemetry, [`cex-byok-and-trade-telemetry.md` (MangroveMarkets#48)](https://github.com/MangroveTechnologies/MangroveMarkets/pull/48), epic [MangroveMarkets#52](https://github.com/MangroveTechnologies/MangroveMarkets/issues/52).*

## Problem

Agents (mangrove-agent via the MangroveMarkets MCP server) need to trade on a user's Kraken account without the user ever creating, copying, stashing, or transmitting a venue API key. BYOK (the #52 chain) solves custody by keeping the key on the user's machine — but it still requires the user to *mint and handle a long-lived venue key*, pushes OAuth-grade security hygiene onto every client, makes attenuation impossible (a raw venue key can't be scoped per call), and leaves broker attribution forkable. The platform already solved custody for the web app: Kraken Connect OAuth grants, KMS-encrypted, with per-call ephemeral Fast API keys and server-injected broker attribution — live-verified end-to-end 2026-07-09 (attributed order `O5JNTR-UOZIC-K6NNPK` → `O7BY6D-ALL4P-YKXO6D`, Kraken-confirmed).

**This design routes agent trading through that same custody.** The MCP server becomes a thin, credential-free proxy; the platform is the single audited OAuth implementation and policy decision point.

## Architecture

```
mangrove-agent ──(MCP, Mangrove API key)──► MangroveMarkets MCP server ──(service cred + acting-user)──► platform member service ──(ephemeral Fast API key + broker IBAN)──► Kraken
     │                                            │                                   │
  no venue creds,                         no venue code, no token             KMS-encrypted grant custody,
  no OAuth client                         custody (MCP spec: MUST NOT        per-call attenuated key mint,
                                          pass through tokens)               policy + audit + gates
```

Design rule from the survey: **one audited OAuth implementation** (Sun/Beznosov CCS 2012), **hard custody boundary** (MCP authorization spec 2025-11-25: the MCP server MUST NOT pass through client tokens; upstream access uses separate credentials — our topology is spec-mandated, not just preferred).

## Flows

### Connect (consent from a terminal agent — RFC 8628 pattern, not wire protocol)

1. `cex_connect_start` (MCP tool, agent-invoked). Auth: the user's Mangrove API key; `user_id` derived **server-side** from the key (mechanism of [MCP-Server#78](https://github.com/MangroveTechnologies/MangroveMarkets-MCP-Server/pull/78)) — never client-supplied.
2. MCP server → platform: *start Kraken connect for user X*. Platform mints single-use, TTL-bounded CSRF `state` bound to X (existing Redis state store) and returns the authorize URL.
3. Agent shows the URL; the human consents in a browser — the only human step, and it is a consent, not key handling. Consent page must state which agent/session initiated (RFC 8628 §5.4 remote-phishing consideration).
4. Kraken redirects to the registered platform callback; completion lands the grant in `account.exchange_connections` (KMS-encrypted), identical row shape to web-initiated connects. v1 requires the browser to be signed into the platform as the same user; a completion-by-state page is a tracked refinement.
5. Agent polls `cex_connect_status` → `connected`.

### Trade

`cex_place_order` / `cex_execute_swap` (MCP) → platform `PlaceExchangeOrder` ([built + live-verified, PR #1035](https://github.com/MangroveTechnologies/mangrove-platform-backend/pull/1035)) with **service credential + acting-user id**. The member service enforces policy (gates, limits, consent), mints the trading-permission Fast API key for the duration of one call, injects the broker IBAN, places, deletes the key. Venue tokens and Fast keys never cross back up the chain (Microsoft OBO lesson; MCP spec).

Delegation semantics per RFC 8693: every order is attributable to *(subject = user, actor = MCP service + user's API key)* — an `act`-shaped audit chain persisted with the order acknowledgment (ICML 2025 authenticated-delegation prescription).

## Security posture (survey-derived musts → concrete controls)

| Must (source) | Control |
|---|---|
| Custody boundary (MCP spec MUST NOT) | Venue tokens/keys exist only inside member service; MCP server holds no venue code at all |
| Audience binding (RFC 8707/9700) | Mangrove API key valid only for our MCP server; service cred valid only for the platform's delegated exchange surface |
| Delegation not impersonation (RFC 8693) | acting-user id required on every delegated call; platform rejects service-identity-only requests |
| Code-flow hygiene (RFC 9700/7636) | PKCE S256 added to the Kraken authorize flow; exact redirect-URI match; single-use state bound to user; no tokens in URLs |
| Attenuation-only minting (Macaroons NDSS 2014) | Per-call Fast keys: query-permission set on read paths, trading set only inside place/cancel; TTL = call duration; delete-before-mint self-heal |
| Complete upfront consent (MS OBO) | Trading scopes named in the one consent; `funds-withdraw` never requested; scope split (read connect vs trading re-consent) tracked in [#1033](https://github.com/MangroveTechnologies/mangrove-platform-backend/issues/1033) |
| Revocation severs chain (Plaid) | Disconnect deletes grant; API-key revocation kills the MCP hop; venue-side revocation in Kraken's Connected Apps UI (no revoke API) |
| Gates | `trading_enabled` env gate (default off) AND per-user consent (#1033) AND per-user risk limits before any strategy-initiated order |
| Attack classes (CCS 2016 / S&P 2019) | Checklist in the research doc §"attack classes"; run per release on the single OAuth implementation |

## Explicit deviations (each with a reason)

1. **Agent↔MCP hop uses a static Mangrove API key, not OAuth 2.1** — spec-aligned for STDIO transport; a documented deviation for HTTP. Migration path to OAuth 2.1 kept open; single-operator platform, no third-party AS federation today.
2. **RFC 8628 adopted as UX/security pattern, not wire protocol** — the platform (not the agent) ends up holding the grant, which 8628 doesn't model; agent polls our status tool instead of a token endpoint.
3. **RFC 8693 as internal model, no public STS** — subject is an API-key-derived user, not a token; if we later mint internal tokens, use literal `act`/`may_act` claims.
4. **FAPI 2.0 met where we are the AS/RS; gap table for the Kraken leg** — PAR/DPoP toward Kraken are venue-capability-bound; compensated by custody (tokens never leave the platform).

## Relationship to BYOK (#52) — coexistence, not replacement

| | OAuth proxy (this design) | BYOK (#52) |
|---|---|---|
| Who it serves | Users with Mangrove accounts | Users who won't link an account |
| User handles keys | Never | Creates + stashes a venue key locally |
| Attenuation / path-split least privilege | Yes (per-call mint) | Impossible (raw key) |
| Broker attribution | Server-injected, tamper-proof | SDK constant, forkable |
| Availability coupling | Requires platform (AWS) up | Fully local |
| Telemetry | Server-side, inherent | Keyless emit (the #52 mechanism) |

BYOK PRs ([#130](https://github.com/MangroveTechnologies/mangrove-agent/pull/130), [#78](https://github.com/MangroveTechnologies/MangroveMarkets-MCP-Server/pull/78), [#50](https://github.com/MangroveTechnologies/MangroveMarkets/pull/50), [#131](https://github.com/MangroveTechnologies/mangrove-agent/pull/131)) proceed unchanged; the telemetry ingestion (#78) serves both paths. This design **completes the BYOK decommission of server-held venue keys** that [MCP-Server#76](https://github.com/MangroveTechnologies/MangroveMarkets-MCP-Server/pull/76) attempted: the MCP server's own Kraken signing path (config-disabled since [#72](https://github.com/MangroveTechnologies/MangroveMarkets-MCP-Server/pull/72)) can be deleted once the proxy lands, because trading goes through the platform.

## Build plan (dependency order)

1. **Platform** (`mangrove-platform-backend`): delegated exchange surface — service-credential auth + acting-user; `connect-start for user X`; wire the per-user consent/limit gates from [#1033](https://github.com/MangroveTechnologies/mangrove-platform-backend/issues/1033); PKCE on the Kraken flow. Prereq: [PR #1035](https://github.com/MangroveTechnologies/mangrove-platform-backend/pull/1035) merged.
2. **MCP server** (`MangroveMarkets-MCP-Server`): `cex_connect_start` / `cex_connect_status`; rewire `cex_place_order` / `cex_validate_order` / `cex_execute_swap` to the platform proxy; then delete `src/cex/kraken` signing internals (finish what #76 started).
3. **mangrove-agent**: `connect kraken` skill (OAuth variant alongside the BYOK `setup-kraken` skill from [#127](https://github.com/MangroveTechnologies/mangrove-agent/pull/127)); order tools; zero key handling.

Accepted trade-offs: trading availability couples to the platform backend; agent users need a Mangrove account. BYOK remains the escape hatch for both.

## Contribution (delta over surveyed art)

No surveyed system composes: (a) platform-custodied venue OAuth grants, (b) per-call **path-split** attenuated venue keys (read paths structurally cannot trade), (c) server-injected venue-native broker attribution on every order including validate-only, and (d) an MCP resource-server front conforming to the 2025-11-25 token-passthrough prohibition with an RFC 8693-shaped delegation audit chain. Plaid has (a) for banking data; Kraken enables (b)+(c) but doesn't compose them; the MCP spec mandates (d) but leaves venue attribution unaddressed. The integrated design is our contribution; BYOK is retained as a deliberate, documented alternative rather than a competing default.
