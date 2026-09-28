# Complete tool results and local wallets

Status: unreleased implementation. No package or deployment is implied by this document.

## Response contract

Existing business methods retain their successful data/model return types. MCP and
REST tool errors are detected before business normalization. TypeScript raises
`ToolCallError` with `code`, optional `suggestion`, and `response`. Python `APIError`
retains `response_headers` and `response_body`. Treat raw responses as sensitive;
do not log them indiscriminately.

Format and validation failures also retain available HTTP status and headers,
including receipt headers. Python `MalformedResponseError` retains the unvalidated
body separately. For an invalid MCP envelope, TypeScript `ToolCallError.responseBody`
holds unvalidated data while `response.result` is an empty error placeholder.
Public error messages remain sanitized; these failures never trigger automatic replay.

For complete response information, use a per-invocation public API:

```ts
const response = await client.callToolResult('wallet_chain_info', { chain: 'xrpl' });
if (response.result.isError) {
  // Handle the tool failure; the complete response remains available.
}
// response.result.content, structuredContent, _meta
// response.status and response.headers on REST
```

```python
response = client.call_tool_result('wallet_chain_info', {'chain': 'xrpl'})
if response.result.is_error:
    pass  # Handle the tool failure using its content/data.
data = response.result.data()
# response.result.content, structured_content, meta; response.status, headers
```

These APIs return the MCP envelope even for a tool-level error. HTTP/protocol/network
failures still raise. Content blocks, structured content and metadata remain separate.
Current string-returning tools may have structured content shaped as
`{"result": "<JSON string>"}`. This is a FastMCP representation, not a receipt.
Python's `data()` and legacy business methods decode the first JSON text for
compatibility, falling back to structured data when appropriate. Raw APIs keep both.
Tool errors are detected in both representations. TypeScript's complete result uses
the official MCP schema; Python preserves unknown content fields for forward compatibility.

REST full-result requests send `X-Mangrove-Result-Format: mcp-v1`. Supporting servers
acknowledge the same response header and return the MCP envelope in the JSON body.
Without that request header, the server returns the existing business JSON. Format
selection is a header, never a business-tool argument. Unsupported format values
are rejected before execution. The server executes the tool only once.

If an older server ignores the header, a full-result client raises an unsupported
format error after that single response. The operation MAY HAVE EXECUTED. Do not
retry automatically. Full-result calls do not automatically replay transient HTTP
failures. Existing Python business-method retry behavior is unchanged and still
requires care for writes and uncertain payment outcomes (T10). No automatic payment
is introduced. Receipt preservation is not receipt verification or evidence that a
particular operation actually produced a receipt.

Use one returned response per call; there is no shared `lastResponse` state.
Applications needing metadata should use the full-result API, not expect existing
normalized quote/balance models to gain protocol fields.

## Local wallets

TypeScript `wallet.create()` now generates XRPL keys locally using `xrpl`, or EVM
keys using the optional `ethers@^6` dependency. Missing ethers is an explicit local
error; it never falls back to the server. Defaults remain XRPL/testnet in TypeScript
and EVM/mainnet in Python. These deliberate defaults are documented, not silently
made identical. Both clients support local XRPL/EVM creation and reject unsupported
Solana creation. No new chain support is claimed.

New wallets are unfunded. Funding is a separate explicit address-only request.
No creation request, key, seed or private key is sent to Markets. The caller still
must store secrets safely and must not log or send returned secrets into chat or
telemetry. Python model repr hides secret fields; explicit serialization retains
its existing behavior. TypeScript result objects contain the secrets for the caller.

Claude and OpenClaw creation actions return `LOCAL_CUSTODY_REQUIRED` before any
key generation or network request. They have no local custody integration, so
returning SDK wallet objects would expose secrets in AI tool results; stripping
those secrets would discard the only recovery material. Supported OpenClaw discovery
no longer advertises wallet creation. Existing named handlers remain explicit local
errors. Use the SDK inside a local wallet manager that securely retains the keys.
A future local-manager integration belongs to the local-boundary work in F08. The remote `wallet_create` remains
retired and hidden; its compatibility error remains unchanged. Generic unsupported
balance/transaction tools are not silently aliased to chain-specific operations.
Local BYOK `KrakenClient` and platform OAuth `client.cex` remain separate contracts.

## Package and rollout order

- Python distribution: `mangrovemarkets`; import: `mangrove_markets`.
- TypeScript distribution: `@mangrove-ai/sdk`.
- Public registry check on 2026-09-26: Python 1.1.0, TypeScript 0.3.0. The alternative
  PyPI name `mangrove-markets` returned 404. These versions do not contain T17.
- Source version fields are unchanged; a source-built candidate bearing an existing
  version is NOT the published package. Publish new, unique versions on release.
- Deploy the reviewed bridge before enabling REST full-result calls. Existing
  clients continue using legacy responses. Publish client versions and announce the
  TypeScript MCP error-handling correction, local unfunded SDK wallet behavior and
  the plugin creation guard (including the previously secret-returning XRPL helper).
- Update plugins to the corrected SDK. Do not switch public hosts or retire
  compatibility handlers as part of this task. T13-T15/T18 security gates remain.
- Rolling back full-result support requires callers to stop using that option;
  never handle unsupported format by automatically reissuing a write.

The authoritative business handlers stay in Markets. Client transports are adapters,
not duplicate business implementations. No parallel skill, billing path or registry
is introduced by this change.

REST requests in the TypeScript transport have a 30-second default timeout,
configurable through its third constructor argument (`timeoutMs`). Python full-result
requests honor the configured client timeout. A timeout is an uncertain outcome,
not proof the server did nothing; neither full-result path automatically replays it.
