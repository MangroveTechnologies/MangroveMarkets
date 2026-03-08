import type { Transport, ToolCallResult } from '../types/transport';

/**
 * 1inch ancillary API service. Provides balance, pricing, token, portfolio,
 * chart, and history data via the MangroveMarkets MCP server.
 */
export class OneInchService {
  constructor(private transport: Transport) {}

  /**
   * Get ERC-20 token balances for a wallet.
   * @param params - Chain ID and wallet address.
   * @returns Token address to balance mapping.
   */
  async getBalances(params: { chainId: number; wallet: string }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_balances', {
      chain_id: params.chainId,
      wallet: params.wallet,
    });
  }

  /**
   * Get ERC-20 token allowances for a wallet and spender.
   * @param params - Chain ID, wallet address, and spender identifier.
   * @returns Token address to allowance mapping.
   */
  async getAllowances(params: { chainId: number; wallet: string; spender: string }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_allowances', {
      chain_id: params.chainId,
      wallet: params.wallet,
      spender: params.spender,
    });
  }

  /**
   * Get current spot prices for one or more tokens.
   * @param params - Chain ID and comma-separated token addresses.
   * @returns Token address to USD price mapping.
   */
  async getSpotPrice(params: { chainId: number; tokens: string }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_spot_price', {
      chain_id: params.chainId,
      tokens: params.tokens,
    });
  }

  /**
   * Get current gas price estimates for a chain.
   * @param params - Chain ID.
   * @returns Gas price data (base fee, priority fee, etc.).
   */
  async getGasPrice(params: { chainId: number }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_gas_price', {
      chain_id: params.chainId,
    });
  }

  /**
   * Search for tokens by name or symbol on a given chain.
   * @param params - Chain ID and search query string.
   * @returns Matching token metadata.
   */
  async searchTokens(params: { chainId: number; query: string }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_token_search', {
      chain_id: params.chainId,
      query: params.query,
    });
  }

  /**
   * Get detailed metadata for a specific token.
   * @param params - Chain ID and token contract address.
   * @returns Token name, symbol, decimals, and logo URL.
   */
  async getTokenInfo(params: { chainId: number; address: string }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_token_info', {
      chain_id: params.chainId,
      address: params.address,
    });
  }

  /**
   * Get total portfolio value in USD for one or more wallet addresses.
   * @param params - Comma-separated wallet addresses and optional chain ID filter.
   * @returns Aggregated portfolio value.
   */
  async getPortfolioValue(params: { addresses: string; chainId?: number }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_portfolio_value', {
      addresses: params.addresses,
      ...(params.chainId ? { chain_id: params.chainId } : {}),
    });
  }

  /**
   * Get profit and loss data for a portfolio.
   * @param params - Comma-separated wallet addresses and optional chain ID filter.
   * @returns PnL breakdown by token and chain.
   */
  async getPortfolioPnl(params: { addresses: string; chainId?: number }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_portfolio_pnl', {
      addresses: params.addresses,
      ...(params.chainId ? { chain_id: params.chainId } : {}),
    });
  }

  /**
   * Get token holdings breakdown for a portfolio.
   * @param params - Comma-separated wallet addresses and optional chain ID filter.
   * @returns Per-token balances and values.
   */
  async getPortfolioTokens(params: { addresses: string; chainId?: number }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_portfolio_tokens', {
      addresses: params.addresses,
      ...(params.chainId ? { chain_id: params.chainId } : {}),
    });
  }

  /**
   * Get DeFi protocol positions for a portfolio.
   * @param params - Comma-separated wallet addresses and optional chain ID filter.
   * @returns DeFi positions by protocol.
   */
  async getPortfolioDefi(params: { addresses: string; chainId?: number }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_portfolio_defi', {
      addresses: params.addresses,
      ...(params.chainId ? { chain_id: params.chainId } : {}),
    });
  }

  /**
   * Get portfolio value chart data over time.
   * @param params - Chain ID, wallet address, and optional time range (default '1month').
   * @returns Time-series chart data points.
   */
  async getChart(params: { chainId: number; address: string; timerange?: string }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_chart', {
      chain_id: params.chainId,
      address: params.address,
      timerange: params.timerange || '1month',
    });
  }

  /**
   * Get transaction history for a wallet address.
   * @param params - Wallet address and optional result limit (default 50).
   * @returns Recent transaction records.
   */
  async getHistory(params: { address: string; limit?: number }): Promise<ToolCallResult> {
    return this.transport.callTool('oneinch_history', {
      address: params.address,
      limit: params.limit || 50,
    });
  }
}
