import type { Transport, ToolCallResult } from '../types/transport';
import type {
  Quote,
  UnsignedTransaction,
  BroadcastResult,
  TransactionStatus,
  QuoteParams,
  ApproveParams,
  BroadcastParams,
  SwapStatusParams,
} from '../types/dex';

/**
 * Low-level DEX service wrapping individual dex_* MCP tools.
 * For high-level swap orchestration, use SwapOrchestrator or MangroveClient.dex.swap().
 */
export class DexService {
  constructor(private transport: Transport) {}

  /**
   * Request a swap quote from the DEX aggregator.
   * @param params - Quote parameters (src, dst, amount, chainId, mode).
   * @returns A server-issued Quote with pricing and expiry.
   */
  async getQuote(params: QuoteParams): Promise<Quote> {
    const result = await this.transport.callTool('dex_get_quote', {
      input_token: params.src,
      output_token: params.dst,
      amount: params.amount,
      chain_id: params.chainId,
      mode: params.mode || 'standard',
    });
    return result as unknown as Quote;
  }

  /**
   * Convert a quote into unsigned swap calldata ready for signing.
   * @param quoteId - ID from a previously obtained Quote.
   * @param slippage - Maximum slippage percentage (default 0.5%).
   * @returns Unsigned transaction calldata for the swap.
   */
  async prepareSwap(params: { quoteId: string; walletAddress: string; slippage?: number }): Promise<UnsignedTransaction> {
    const result = await this.transport.callTool('dex_prepare_swap', {
      quote_id: params.quoteId,
      wallet_address: params.walletAddress,
      slippage: params.slippage ?? 0.5,
    });
    return result as unknown as UnsignedTransaction;
  }

  /**
   * Generate an unsigned ERC-20 approval transaction for the DEX router.
   * @param params - Token address, chain ID, and optional specific amount.
   * @returns Unsigned approval transaction calldata.
   */
  async approveToken(params: ApproveParams): Promise<UnsignedTransaction> {
    const result = await this.transport.callTool('dex_approve_token', {
      token_address: params.tokenAddress,
      chain_id: params.chainId,
      wallet_address: params.walletAddress,
      ...(params.amount ? { amount: params.amount } : {}),
    });
    return result as unknown as UnsignedTransaction;
  }

  /**
   * Broadcast a signed transaction to the network.
   * @param params - Chain ID, signed transaction hex, and MEV protection flag.
   * @returns Broadcast result with transaction hash.
   */
  async broadcast(params: BroadcastParams): Promise<BroadcastResult> {
    const result = await this.transport.callTool('dex_broadcast', {
      chain_id: params.chainId,
      signed_tx: params.signedTx,
      mev_protection: params.mevProtection || false,
    });
    return result as unknown as BroadcastResult;
  }

  /**
   * Check the on-chain status of a transaction.
   * @param params - Transaction hash and chain ID.
   * @returns Current transaction status (pending, confirmed, or failed).
   */
  async txStatus(params: SwapStatusParams): Promise<TransactionStatus> {
    const result = await this.transport.callTool('dex_tx_status', {
      tx_hash: params.txHash,
      chain_id: params.chainId,
    });
    return result as unknown as TransactionStatus;
  }

  /**
   * List all venues supported by the DEX aggregator.
   * @returns Supported venue metadata.
   */
  async supportedVenues(): Promise<ToolCallResult> {
    return this.transport.callTool('dex_supported_venues', {});
  }

  /**
   * List supported trading pairs, optionally filtered by chain or venue.
   * @param chainId - Optional chain ID filter.
   * @param venue - Optional venue name filter (e.g. '1inch').
   * @returns Supported trading pair metadata.
   */
  async supportedPairs(venueId: string): Promise<ToolCallResult> {
    return this.transport.callTool('dex_supported_pairs', {
      venue_id: venueId,
    });
  }
}
