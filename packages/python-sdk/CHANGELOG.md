# Changelog

All notable changes to the `mangrovemarkets` Python SDK are documented here.

## 0.1.2 — 2026-04-24

### Fixed

- **`dex.token_info()`**: unwrap the server's `{"token": {...}}` envelope before
  validating against `TokenInfo`. Previously every call raised 4 pydantic
  validation errors because the SDK expected flat fields. (#62)
- **`dex.chart()`**: updated to match the current server contract. 1inch removed
  the pair-based OHLCV endpoint; the `oneinch_chart` server tool now takes a
  single `address` and a `timerange`. (#63)

### Breaking

- **`DexService.chart(chain_id, token0, token1, period)` → `DexService.chart(chain_id, address, timerange="1month")`**.
  The old signature 500'd on every call against a 0.1.1 server, so this breakage
  is symbolic — no working caller is depending on the old kwargs. Callers that
  passed `token0`/`token1`/`period` now raise a clear `TypeError`.

## 0.1.1 — 2026-04-22

Previously published to PyPI (see git tag `python-sdk-v0.1.1`).

## 0.1.0 — 2026-04-18

Initial release.
