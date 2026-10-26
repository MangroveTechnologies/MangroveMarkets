/** Encode caller-owned MCP payment metadata for the REST bridge. Never signs or retries. */
export function metadataHeaders(meta?: Record<string, unknown>): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [namespace, value] of Object.entries(meta ?? {})) {
    if (namespace === 'x402/payment') {
      headers['PAYMENT-SIGNATURE'] = btoa(
        Array.from(new TextEncoder().encode(JSON.stringify(value)), byte => String.fromCharCode(byte)).join(''),
      );
      continue;
    }
    const fields: Record<string, string> = namespace === 'mangrove/payment'
      ? { operation_id: 'X-Payment-Operation-Id', recovery_token: 'X-Payment-Recovery-Token', action_id: 'X-Payment-Action-Id' }
      : namespace === 'mangrove/quota' ? { operation_id: 'X-Quota-Operation-Id' } : {};
    if (!Object.keys(fields).length || !value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Unsupported tool metadata');
    }
    for (const [field, item] of Object.entries(value)) {
      if (!Object.prototype.hasOwnProperty.call(fields, field) || typeof item !== 'string') {
        throw new Error('Unsupported recovery metadata');
      }
      headers[fields[field]] = item;
    }
  }
  return headers;
}
