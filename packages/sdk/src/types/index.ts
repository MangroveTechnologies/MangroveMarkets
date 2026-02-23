/**
 * TypeScript types for Mangrove Markets SDK
 */

/**
 * SDK Configuration
 */
export interface MangroveConfig {
  /** Base URL of the MCP server */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  timestamp: string;
  checks?: {
    database: { status: string; latency_ms?: number; error?: string };
    xrpl: { status: string; error?: string };
    mcp_server: { status: string; version?: string };
  };
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

/**
 * Marketplace Types
 */
export interface MarketplaceListing {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  seller_address: string;
  status: 'active' | 'inactive' | 'sold';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface CreateListingRequest {
  name: string;
  description: string;
  category: string;
  price: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

/**
 * DEX Types
 */
export interface DexQuote {
  from_token: string;
  to_token: string;
  from_amount: string;
  to_amount: string;
  price_impact: number;
  route: string[];
  estimated_gas: number;
  expires_at: string;
}

export interface SwapRequest {
  from_token: string;
  to_token: string;
  amount: string;
  side: 'buy' | 'sell';
  slippage?: number;
}

export interface SwapResponse {
  tx_hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  from_token: string;
  to_token: string;
  from_amount: string;
  to_amount: string;
}

/**
 * Wallet Types
 */
export interface WalletBalance {
  address: string;
  token: string;
  balance: string;
  balance_usd?: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  token: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  block_number?: number;
}

/**
 * Agent Types
 */
export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  price_per_call: number;
  rating: number;
  owner_address: string;
  status: 'online' | 'offline' | 'busy';
}

export interface AgentCallRequest {
  agent_id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface AgentCallResponse {
  result: unknown;
  execution_time_ms: number;
}
