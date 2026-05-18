/**
 * Wallet type definitions matching the MCP server's wallet_* tools.
 */

// -- Response types --

/** Network configuration within a chain. */
export interface NetworkInfo {
  name: string;
  rpcUrl?: string;
  explorer?: string;
  faucetUrl?: string;
}

/**
 * Chain configuration returned by wallet_chain_info.
 * Shape varies by chain family (XRPL has faucets, EVM has chain IDs, etc.).
 */
export interface ChainInfo {
  chain: string;
  chainFamily: string;
  nativeToken: string;
  walletCreation: string;
  networks: Record<string, NetworkInfo>;
  /** EVM-only: supported chain IDs. */
  supportedChainIds?: number[];
  /** EVM/Solana: SDK method hint for client-side wallet creation. */
  sdkMethod?: string;
}

/** Result from wallet_create (XRPL faucet or EVM keypair). */
export interface WalletCreateResult {
  address: string;
  chain: string;
  network: string;
  isFunded: boolean;
  warnings: string[];
  /** XRPL-only: wallet secret (seed). */
  secret?: string;
  /** XRPL-only: BIP-39 seed phrase. */
  seedPhrase?: string | null;
  /** EVM-only: private key hex. */
  privateKey?: string;
  /** EVM-only: chain ID. */
  chainId?: number;
}

/** Result from wallet_balance (stub -- NOT_IMPLEMENTED). */
export interface BalanceResult {
  address: string;
  chain: string;
  balances: Record<string, string>;
}

/** Result from wallet_transactions (stub -- NOT_IMPLEMENTED). */
export interface TransactionHistoryResult {
  address: string;
  chain: string;
  transactions: unknown[];
}

// -- Parameter types --

/** Parameters for wallet_chain_info. */
export interface ChainInfoParams {
  /** Chain family: 'xrpl', 'evm', or 'solana'. Defaults to 'xrpl'. */
  chain?: string;
}

/** Parameters for wallet_create. */
export interface CreateWalletParams {
  /** Chain family: 'xrpl', 'evm', or 'solana'. Defaults to 'xrpl'. */
  chain?: string;
  /** XRPL network: 'testnet', 'devnet', or 'mainnet'. Defaults to 'testnet'. */
  network?: string;
  /** EVM chain ID (1=Ethereum, 8453=Base, 42161=Arbitrum). Defaults to 1. */
  chainId?: number;
}

/** Parameters for wallet_balance. */
export interface BalanceParams {
  /** Wallet address to check. */
  address: string;
  /** Chain family: 'xrpl', 'evm', or 'solana'. Defaults to 'xrpl'. */
  chain?: string;
  /** EVM chain ID (required for EVM chains). */
  chainId?: number;
}

/** Parameters for wallet_transactions. */
export interface TransactionsParams {
  /** Wallet address to query. */
  address: string;
  /** Chain family: 'xrpl', 'evm', or 'solana'. Defaults to 'xrpl'. */
  chain?: string;
  /** EVM chain ID (required for EVM chains). */
  chainId?: number;
  /** Max transactions to return. Defaults to 20. */
  limit?: number;
}
