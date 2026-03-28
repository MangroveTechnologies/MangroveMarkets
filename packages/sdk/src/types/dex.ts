/**
 * Server-issued swap quote with pricing, fees, and expiry.
 */
export interface Quote {
  /** Unique quote identifier, valid until expiresAt. */
  quoteId: string;
  /** DEX venue that will execute the swap (e.g. '1inch'). */
  venueId: string;
  /** Contract address of the token being sold. */
  inputToken: string;
  /** Contract address of the token being bought. */
  outputToken: string;
  /** Amount of input token in smallest unit (wei). */
  inputAmount: string;
  /** Expected amount of output token in smallest unit (wei). */
  outputAmount: string;
  /** Mangrove fee amount in smallest unit of input token. */
  mangroveFee: string;
  /** EVM chain ID where the swap will execute. */
  chainId: number;
  /** Billing mode used for this quote. */
  billingMode: 'standard';
  /** Ordered list of DEX routes the aggregator will use. */
  routes: string[];
  /** ISO 8601 timestamp after which this quote is no longer valid. */
  expiresAt: string;
}

/**
 * Chain-agnostic unsigned transaction calldata. Agent signs locally.
 */
export interface UnsignedTransaction {
  /** EVM chain ID for the transaction. */
  chainId: number;
  /** Target contract address. */
  to: string;
  /** ABI-encoded calldata. */
  data: string;
  /** Native token value to send (wei). */
  value: string;
  /** Gas limit for the transaction. */
  gas: string;
  /** Transaction nonce (sequence number). */
  nonce?: number;
  /** Legacy gas price (wei). Mutually exclusive with EIP-1559 fields. */
  gasPrice?: string;
  /** EIP-1559 max fee per gas (wei). */
  maxFeePerGas?: string;
  /** EIP-1559 max priority fee per gas (wei). */
  maxPriorityFeePerGas?: string;
}

/**
 * Result returned after broadcasting a signed transaction.
 */
export interface BroadcastResult {
  /** Transaction hash of the broadcasted transaction. */
  txHash: string;
  /** Chain ID the transaction was broadcast on. */
  chainId: number;
  /** Method used to broadcast (e.g. 'public', 'flashbots'). */
  broadcastMethod: string;
}

/**
 * Current status of an on-chain transaction.
 */
export interface TransactionStatus {
  /** Transaction hash being tracked. */
  txHash: string;
  /** Chain ID the transaction is on. */
  chainId: number;
  /** Current transaction status. */
  status: 'pending' | 'confirmed' | 'failed';
  /** Block number the transaction was included in, if confirmed. */
  blockNumber?: number;
  /** Gas consumed by the transaction, if confirmed. */
  gasUsed?: string;
}

/**
 * Final result of a completed swap operation.
 */
export interface SwapResult {
  /** Transaction hash of the swap. */
  txHash: string;
  /** Chain ID the swap executed on. */
  chainId: number;
  /** Final transaction status. */
  status: 'confirmed' | 'failed';
  /** Gas consumed by the swap transaction. */
  gasUsed: string;
  /** Contract address of the token sold. */
  inputToken: string;
  /** Contract address of the token bought. */
  outputToken: string;
  /** Amount of input token swapped (smallest unit). */
  inputAmount: string;
  /** Amount of output token received (smallest unit). */
  outputAmount: string;
}

/**
 * Parameters for requesting a swap quote.
 */
export interface QuoteParams {
  /** Source token contract address. */
  src: string;
  /** Destination token contract address. */
  dst: string;
  /** Amount of source token in smallest unit (wei). */
  amount: string;
  /** EVM chain ID to get the quote on. */
  chainId: number;
}

/**
 * Parameters for executing a full swap (quote through confirmation).
 */
export interface SwapParams {
  /** Source token contract address. */
  src: string;
  /** Destination token contract address. */
  dst: string;
  /** Amount of source token in smallest unit (wei). */
  amount: string;
  /** EVM chain ID to execute the swap on. */
  chainId: number;
  /** Maximum acceptable slippage percentage (e.g. 0.5 = 0.5%). Defaults to 0.5. */
  slippage?: number;
  /** Whether to use Flashbots or similar MEV protection. Defaults to false. */
  mevProtection?: boolean;
}

/**
 * Parameters for generating an ERC-20 token approval transaction.
 */
export interface ApproveParams {
  /** ERC-20 token contract address to approve. */
  tokenAddress: string;
  /** EVM chain ID. */
  chainId: number;
  /** The agent's public wallet address. */
  walletAddress: string;
  /** Specific approval amount (wei). Omit for unlimited approval. */
  amount?: string;
}

/**
 * Parameters for broadcasting a signed transaction.
 */
export interface BroadcastParams {
  /** EVM chain ID to broadcast on. */
  chainId: number;
  /** Raw signed transaction hex string. */
  signedTx: string;
  /** Whether to use MEV protection for broadcast. Defaults to false. */
  mevProtection?: boolean;
}

/**
 * Parameters for checking the status of a swap transaction.
 */
export interface SwapStatusParams {
  /** Transaction hash to check. */
  txHash: string;
  /** EVM chain ID the transaction is on. */
  chainId: number;
}
