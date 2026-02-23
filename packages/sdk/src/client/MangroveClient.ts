import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  MangroveConfig,
  HealthResponse,
  MarketplaceListing,
  DexQuote,
  WalletBalance,
  ApiResponse,
} from '../types';

/**
 * Main client for Mangrove Markets API
 */
export class MangroveClient {
  private client: AxiosInstance;
  public readonly baseUrl: string;

  constructor(config: MangroveConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:8080';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    // Add auth interceptor if token is provided
    if (config.apiKey) {
      this.client.interceptors.request.use((cfg) => {
        cfg.headers['Authorization'] = `Bearer ${config.apiKey}`;
        return cfg;
      });
    }
  }

  /**
   * Health check
   */
  async health(includeChecks = false): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/health', {
      params: { include_checks: includeChecks },
    });
    return response.data;
  }

  /**
   * Get service status
   */
  async status(): Promise<{ version: string; status: string }> {
    const response = await this.client.get('/status');
    return response.data;
  }

  // ==================== Marketplace ====================

  /**
   * List all marketplace listings
   */
  async listListings(params?: {
    category?: string;
    status?: string;
    limit?: number;
  }): Promise<ApiResponse<MarketplaceListing[]>> {
    const response = await this.client.get('/marketplace/listings', { params });
    return response.data;
  }

  /**
   * Get a specific listing by ID
   */
  async getListing(listingId: string): Promise<MarketplaceListing> {
    const response = await this.client.get(`/marketplace/listings/${listingId}`);
    return response.data;
  }

  /**
   * Create a new marketplace listing
   */
  async createListing(listing: Partial<MarketplaceListing>): Promise<MarketplaceListing> {
    const response = await this.client.post('/marketplace/listings', listing);
    return response.data;
  }

  // ==================== DEX ====================

  /**
   * Get a quote for a token swap
   */
  async getDexQuote(params: {
    fromToken: string;
    toToken: string;
    amount: string;
    side: 'buy' | 'sell';
  }): Promise<DexQuote> {
    const response = await this.client.get('/dex/quote', { params });
    return response.data;
  }

  /**
   * Execute a token swap
   */
  async executeSwap(params: {
    fromToken: string;
    toToken: string;
    amount: string;
    side: 'buy' | 'sell';
    slippage?: number;
  }): Promise<{ txHash: string; status: string }> {
    const response = await this.client.post('/dex/swap', params);
    return response.data;
  }

  // ==================== Wallet ====================

  /**
   * Get wallet balances
   */
  async getBalances(address: string): Promise<WalletBalance[]> {
    const response = await this.client.get(`/wallet/${address}/balances`);
    return response.data;
  }

  /**
   * Get transaction history
   */
  async getTransactions(address: string, limit = 50): Promise<ApiResponse<unknown[]>> {
    const response = await this.client.get(`/wallet/${address}/transactions`, {
      params: { limit },
    });
    return response.data;
  }

  // ==================== Utility ====================

  /**
   * Make a raw MCP tool call
   */
  async callTool<T = unknown>(toolName: string, params: Record<string, unknown>): Promise<T> {
    const response = await this.client.post('/mcp/call', {
      tool: toolName,
      params,
    });
    return response.data;
  }

  /**
   * Close the client (cleanup connections)
   */
  async close(): Promise<void> {
    // Axios doesn't require explicit cleanup, but this is here for future expansion
  }
}
