# CEX (Kraken) BYOK + Trade Telemetry — Decision Record & Action Plan

**Status:** accepted · **Date:** 2026-06-27
**Scope:** how a user trades their own Kraken (CEX) account through the agent, how their
API key is custodied, and how Mangrove captures per-user trade statistics without ever
holding the key.

This doc exists so the model is settled once and not re-derived. (Prior sessions
rabbit-holed by conflating the three different "Kraken" touchpoints below.)

---

## 1. The core insight — three Kraken touchpoints, do not conflate

| # | Where | What it is | Whose key | Status |
|---|---|---|---|---|
| 1 | `MangroveRoots/providers/kraken_rest/` | **Public market data** (OHLCV, price) | none (public) | exists |
| 2 | `MangroveMarkets-MCP-Server/src/cex/kraken/` + `adapters/kraken.py` | **Server-side execution** — server holds one `KRAKEN_API_KEY`/`SECRET` and trades | one **Mangrove-held** key (house account) | exists |
| 3 | `mangrovemarkets` python-sdk → a client-side `KrakenClient` | **Local BYOK execution** — SDK talks to `api.kraken.com` directly | the **user's** key, on the **user's** machine | **NOT built** |

The trap: #2 already works, so an agent assumes that is "Kraken trading." But #2 requires the
key to live on a Mangrove server (today a single house key). **User trading must be #3.** #2
stays as the house-account / future server-side **OAuth2** mode — a different product, not user BYOK.

## 2. Layer architecture (who does what)

- **MangroveRoots** — shared **read-only market data** + shared **data models**. Owns the
  canonical `TradeRecord` schema (§5). No per-user keys, no execution.
- **MangroveMarkets-MCP-Server** — hosted **backend**. Keyless for DEX (client signs locally,
  server routes/quotes/broadcasts). Owns the **trade-telemetry ingestion + per-user storage**
  (§4). Not in the per-user Kraken execution path.
- **`mangrovemarkets` python-sdk** — the **client library** the agent imports. Owns the
  client-side **`KrakenClient`** (BYOK, direct to Kraken) and the **emit** of `TradeRecord`s.
- **mangrove-agent** — the local app. Owns the **key stash** (Fernet vault, out-of-band),
  the `cex_*` tools, and the user-facing flow (`setup-kraken` skill).

**SDK ≠ server:** the SDK is the client you import; the MCP server is the backend it calls.
For DEX: SDK → server → 1inch. For BYOK Kraken: SDK → Kraken **directly** (server not in path).

## 3. Custody model

- **BYOK, local.** The user's Kraken key is created least-privilege (**Withdraw OFF**), stored
  encrypted at rest on the user's machine (Fernet SecretVault, same model as wallet secrets),
  entered out-of-band — **never pasted in chat, never sent to a Mangrove server.**
- The client-side `KrakenClient` uses it to call `api.kraken.com` directly.
- Server-side execution with a Mangrove-held key (#2) and the future **OAuth2** grant are
  separate modes, explicitly NOT this path.

## 4. Statistics seam — keyless telemetry

Because execution + key are local, Mangrove cannot observe trades server-side. So the client
**pushes trade statistics** (not keys, not the order flow) to a Mangrove ingestion endpoint.

- **Identity = the Mangrove API key.** The same key the rest of the platform uses; the agent
  already carries `MANGROVE_API_KEY`. No new auth system.
- **Server derives `user_id` from the authenticated key** and stamps the stored record. The
  client never supplies its own identity (anti-spoofing).
- **Enforcement is at ingestion, not at execution.** You cannot gate a local trade; you gate
  the *value* — no valid Mangrove key on the emit ⇒ `401` ⇒ no stored record. Tracking is the
  carrot to hold a key (fits the agent's free / auth / x402 tiers: tracked history is the
  `auth` tier).
- **Self-reported caveat.** Mangrove doesn't independently see Kraken, so stats are trusted
  self-reports. Mitigant: the agent has "Query Closed Orders & Trades" scope, so it can pull
  the user's **actual Kraken fills** locally and emit *those* — real data, key still local.

## 5. `TradeRecord` schema + the tx-hash reality

**A Kraken spot trade has no blockchain tx hash** — it is an internal ledger entry. Kraken
gives a **trade reference** (`trade_id`, the `TradesHistory` key, e.g. `TQLM2-…`) and an
**order reference** (`ordertxid`). A real `tx_hash` only exists for **DEX** legs and for
on-chain deposits/withdrawals — never the CEX spot fill. (Translation already modeled
server-side in `src/cex/kraken/mapping.py::to_trade_detail` — reuse it, don't rewrite.)

So the identifier is **polymorphic**, not a forced `tx_hash`:

| field | CEX (Kraken) | DEX (1inch/…) |
|---|---|---|
| `venue` | `kraken` | `1inch`/`xpmarket`/`jupiter` |
| `venue_order_ref` | `ordertxid` | router/null |
| `venue_trade_ref` | `trade_id` | null |
| `tx_hash` | **null** (off-chain) | on-chain hash |

Full record (owned by MangroveRoots): `user_id` (server-stamped), `venue`, `side`,
`base`/`quote`, `qty`, `price`, `fee`, `cost`, `pnl?`, `ts`, `mode` (`validate`|`live`),
`venue_order_ref`, `venue_trade_ref`, `tx_hash?`. A report's "transaction identifier" column
resolves to `tx_hash` for DEX and `venue_trade_ref` for CEX.

## 6. Action plan (dependency-ordered, bottom-up)

| # | Repo | Deliverable | Depends on |
|---|---|---|---|
| 1 | **MangroveRoots** | `TradeRecord` shared schema (§5). Bump `mangrove-roots`. | — |
| 2 | **MangroveMarkets-MCP-Server** | Replace `metrics_*` `NOT_IMPLEMENTED` stubs: (a) `record_trade` ingestion (auth = Mangrove key → server-derived `user_id` → validate vs schema → persist per user); (b) read-side per-user history/stats. **401 without a key = enforcement.** | 1 |
| 3 | **MangroveMarkets/python-sdk** | Client-side `KrakenClient` (BYOK, direct to `api.kraken.com`): place/validate orders + `query_trades()` → `trade_id`/`ordertxid`; `report_trades()` emits `TradeRecord`s to step 2 (auth = Mangrove key). Reuse server Kraken mapping; extract keyless translation to shared if cheap. Bump `mangrovemarkets`. | 1, 2 |
| 4 | **mangrove-agent** | Finish the `setup-kraken` skill's "still being built": Kraken-key stash command (mirror `stash-secret.sh`), `cex_*` tools wired to the SDK `KrakenClient`, emit-after-trade + "pull my Kraken fills and report" flow. | 3 |

Steps 1–2 are buildable today with **no Kraken key at all** (schema + endpoint + identity),
de-risking the front half. Release order is bottom-up: Roots → server + SDK → agent.

## 7. Invariants (non-negotiable)

1. The BYOK Kraken key never leaves the user's machine and is never pasted in chat.
2. Identity = Mangrove API key; the **server** derives `user_id` from it — never client-supplied.
3. Enforce at ingestion (`401` without a key), not at local execution.
4. Kraken spot fills carry `venue_trade_ref`, not `tx_hash`; never force a chain hash on a CEX row.
5. Don't conflate BYOK (#3) with the server-side-key / OAuth2 mode (#2).
