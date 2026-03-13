/**
 * Typed response interfaces for 1inch ancillary API methods.
 */

/**
 * ERC-20 token balance for a single token in a wallet.
 */
export interface TokenBalance {
  /** Token contract address. */
  address: string;
  /** Raw balance in smallest unit (wei). */
  balance: string;
  /** Token decimal places. */
  decimals: number;
  /** Token ticker symbol (e.g. 'USDC'). */
  symbol: string;
  /** Human-readable token name (e.g. 'USD Coin'). */
  name: string;
}

/**
 * Gas price estimates for an EVM chain.
 */
export interface GasPrice {
  /** Base fee in gwei. */
  baseFee: string;
  /** Recommended max priority fee per gas in gwei. */
  maxPriorityFeePerGas: string;
  /** Recommended max fee per gas in gwei. */
  maxFeePerGas: string;
}

/**
 * Metadata for an ERC-20 token.
 */
export interface TokenInfo {
  /** Token contract address. */
  address: string;
  /** Token ticker symbol (e.g. 'USDC'). */
  symbol: string;
  /** Human-readable token name (e.g. 'USD Coin'). */
  name: string;
  /** Token decimal places. */
  decimals: number;
  /** URL to the token logo image. */
  logoURI: string;
}

/**
 * Aggregated portfolio value for one or more wallets.
 */
export interface PortfolioValue {
  /** Total portfolio value in USD. */
  total_usd: string;
  /** Value breakdown by chain. */
  chains: Record<string, string>;
  /** Value breakdown by token. */
  tokens: Record<string, string>;
}
