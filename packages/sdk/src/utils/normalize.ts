/**
 * Response normalizers for converting server wire format (snake_case, nested payload)
 * to SDK TypeScript types (camelCase, flat structures).
 *
 * The Python server returns Pydantic model_dump() output with snake_case keys.
 * The SDK types use camelCase per TypeScript convention.
 */

import type {
  Quote,
  UnsignedTransaction,
  BroadcastResult,
  TransactionStatus,
} from '../types/dex';

type ServerResponse = Record<string, unknown>;

/**
 * Normalize a server quote response to SDK Quote type.
 *
 * Server fields: quote_id, venue_id, input_token, output_token, input_amount,
 * output_amount, mangrove_fee, chain_id, billing_mode, routes, expires_at
 */
export function normalizeQuote(raw: ServerResponse): Quote {
  return {
    quoteId: (raw.quote_id ?? raw.quoteId) as string,
    venueId: (raw.venue_id ?? raw.venueId) as string,
    inputToken: (raw.input_token ?? raw.inputToken ?? raw.src_token_address) as string,
    outputToken: (raw.output_token ?? raw.outputToken ?? raw.dst_token_address) as string,
    inputAmount: String(raw.input_amount ?? raw.inputAmount ?? '0'),
    outputAmount: String(raw.output_amount ?? raw.outputAmount ?? '0'),
    mangroveFee: String(raw.mangrove_fee ?? raw.mangroveFee ?? '0'),
    chainId: (raw.chain_id ?? raw.chainId) as number,
    billingMode: (raw.billing_mode ?? raw.billingMode ?? 'standard') as 'standard' | 'x402',
    routes: (raw.routes ?? []) as string[],
    expiresAt: (raw.expires_at ?? raw.expiresAt ?? '') as string,
  };
}

/**
 * Normalize a server UnsignedTransaction response to SDK UnsignedTransaction type.
 *
 * Server nests EVM-specific fields inside `payload: {to, data, value, gas, ...}`.
 * SDK expects them flat: {chainId, to, data, value, gas, ...}.
 */
export function normalizeUnsignedTx(raw: ServerResponse): UnsignedTransaction {
  const payload = (raw.payload ?? {}) as Record<string, unknown>;
  const chainId = (payload.chainId ?? raw.chain_id ?? raw.chainId) as number;

  const nonce = payload.nonce ?? raw.nonce;

  return {
    chainId,
    to: (payload.to ?? raw.to) as string,
    data: (payload.data ?? raw.data) as string,
    value: String(payload.value ?? raw.value ?? '0'),
    gas: String(payload.gas ?? raw.gas ?? '0'),
    ...(nonce != null ? { nonce: Number(nonce) } : {}),
    ...(payload.gasPrice ? { gasPrice: String(payload.gasPrice) } : {}),
    ...(payload.maxFeePerGas ? { maxFeePerGas: String(payload.maxFeePerGas) } : {}),
    ...(payload.maxPriorityFeePerGas ? { maxPriorityFeePerGas: String(payload.maxPriorityFeePerGas) } : {}),
  };
}

/**
 * Normalize a server BroadcastResult response to SDK BroadcastResult type.
 *
 * Server fields: tx_hash, chain_family, chain_id, venue_id, broadcast_method
 */
export function normalizeBroadcastResult(raw: ServerResponse): BroadcastResult {
  return {
    txHash: (raw.tx_hash ?? raw.txHash) as string,
    chainId: (raw.chain_id ?? raw.chainId) as number,
    broadcastMethod: (raw.broadcast_method ?? raw.broadcastMethod ?? 'public') as string,
  };
}

/**
 * Normalize a server TransactionStatus response to SDK TransactionStatus type.
 *
 * Server fields: tx_hash, chain_family, chain_id, status, block_number,
 * confirmations, gas_used, error_message, raw
 */
export function normalizeTransactionStatus(raw: ServerResponse): TransactionStatus {
  return {
    txHash: (raw.tx_hash ?? raw.txHash) as string,
    chainId: (raw.chain_id ?? raw.chainId) as number,
    status: (raw.status as 'pending' | 'confirmed' | 'failed'),
    ...(raw.block_number != null || raw.blockNumber != null
      ? { blockNumber: (raw.block_number ?? raw.blockNumber) as number }
      : {}),
    ...(raw.gas_used != null || raw.gasUsed != null
      ? { gasUsed: String(raw.gas_used ?? raw.gasUsed) }
      : {}),
  };
}
