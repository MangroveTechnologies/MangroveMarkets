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
import type {
  TokenBalance,
  GasPrice,
  TokenInfo,
} from '../types/oneinch';
import type {
  Listing,
  SearchResult,
  CreateListingResult,
} from '../types/marketplace';

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

/**
 * Normalize a server token balance entry to SDK TokenBalance type.
 *
 * Server may return snake_case or camelCase fields.
 */
export function normalizeTokenBalance(raw: ServerResponse): TokenBalance {
  return {
    address: (raw.address ?? '') as string,
    balance: String(raw.balance ?? '0'),
    decimals: (raw.decimals ?? 0) as number,
    symbol: (raw.symbol ?? '') as string,
    name: (raw.name ?? '') as string,
  };
}

/**
 * Normalize a server gas price response to SDK GasPrice type.
 *
 * Server fields: baseFee / base_fee, maxPriorityFeePerGas / max_priority_fee_per_gas,
 * maxFeePerGas / max_fee_per_gas
 */
export function normalizeGasPrice(raw: ServerResponse): GasPrice {
  return {
    baseFee: String(raw.baseFee ?? raw.base_fee ?? '0'),
    maxPriorityFeePerGas: String(raw.maxPriorityFeePerGas ?? raw.max_priority_fee_per_gas ?? '0'),
    maxFeePerGas: String(raw.maxFeePerGas ?? raw.max_fee_per_gas ?? '0'),
  };
}

/**
 * Normalize a server token info response to SDK TokenInfo type.
 *
 * Server fields: address, symbol, name, decimals, logoURI / logo_uri / logoUrl
 */
export function normalizeTokenInfo(raw: ServerResponse): TokenInfo {
  return {
    address: (raw.address ?? '') as string,
    symbol: (raw.symbol ?? '') as string,
    name: (raw.name ?? '') as string,
    decimals: (raw.decimals ?? 0) as number,
    logoURI: (raw.logoURI ?? raw.logo_uri ?? raw.logoUrl ?? raw.logo_url ?? '') as string,
  };
}

// -- Marketplace normalizers --

/**
 * Normalize a server create-listing response to SDK CreateListingResult.
 *
 * Server fields: listing_id, status, created_at
 */
export function normalizeCreateListingResult(raw: ServerResponse): CreateListingResult {
  return {
    listingId: (raw.listing_id ?? raw.listingId) as string,
    status: (raw.status ?? 'active') as CreateListingResult['status'],
    createdAt: (raw.created_at ?? raw.createdAt ?? '') as string,
  };
}

/**
 * Normalize a server listing response to SDK Listing type.
 *
 * Server fields: listing_id, seller_address, title, description, category,
 * subcategory, price_xrp, listing_type, status, tags, storage_uri,
 * content_hash, created_at, updated_at, expires_at
 */
export function normalizeListing(raw: ServerResponse): Listing {
  return {
    listingId: (raw.listing_id ?? raw.listingId) as string,
    sellerAddress: (raw.seller_address ?? raw.sellerAddress) as string,
    title: (raw.title ?? '') as string,
    description: (raw.description ?? '') as string,
    category: (raw.category ?? 'other') as Listing['category'],
    subcategory: (raw.subcategory ?? null) as string | null,
    priceXrp: (raw.price_xrp ?? raw.priceXrp ?? 0) as number,
    listingType: (raw.listing_type ?? raw.listingType ?? 'static') as Listing['listingType'],
    status: (raw.status ?? 'active') as Listing['status'],
    tags: (raw.tags ?? []) as string[],
    storageUri: (raw.storage_uri ?? raw.storageUri ?? null) as string | null,
    contentHash: (raw.content_hash ?? raw.contentHash ?? null) as string | null,
    createdAt: (raw.created_at ?? raw.createdAt ?? '') as string,
    updatedAt: (raw.updated_at ?? raw.updatedAt ?? '') as string,
    expiresAt: (raw.expires_at ?? raw.expiresAt ?? null) as string | null,
  };
}

/**
 * Normalize a server search response to SDK SearchResult type.
 *
 * Server fields: listings (array of listing dicts), total_count, next_cursor
 */
export function normalizeSearchResult(raw: ServerResponse): SearchResult {
  const rawListings = (raw.listings ?? []) as ServerResponse[];
  return {
    listings: rawListings.map(normalizeListing),
    totalCount: (raw.total_count ?? raw.totalCount ?? 0) as number,
    nextCursor: (raw.next_cursor ?? raw.nextCursor ?? null) as string | null,
  };
}
