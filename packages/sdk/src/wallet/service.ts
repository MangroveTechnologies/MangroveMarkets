import type { Transport, ToolCallResult } from '../types/transport';
import type {
  ChainInfo,
  ChainInfoParams,
  WalletCreateResult,
  CreateWalletParams,
  BalanceResult,
  BalanceParams,
  TransactionHistoryResult,
  TransactionsParams,
} from '../types/wallet';

/**
 * Low-level wallet service wrapping the wallet_* MCP tools.
 * Provides chain info, wallet creation, balance queries, and transaction history.
 */
export class WalletService {
  constructor(private transport: Transport) {}

  /**
   * Get chain configuration: supported networks, RPC URLs, native token info.
   * Call this before creating a wallet to understand chain requirements.
   * @param params - Optional chain family filter (defaults to 'xrpl').
   */
  async chainInfo(params: ChainInfoParams = {}): Promise<ChainInfo> {
    const result = await this.transport.callTool('wallet_chain_info', {
      chain: params.chain ?? 'xrpl',
    });
    return normalizeChainInfo(result as Record<string, unknown>);
  }

  /**
   * Create a new wallet. XRPL wallets are funded via testnet/devnet faucet.
   * EVM wallets generate a random keypair. Solana is Phase 3.
   * @param params - Chain, network, and optional chain ID.
   */
  async create(params: CreateWalletParams = {}): Promise<WalletCreateResult> {
    const toolParams: Record<string, unknown> = {
      chain: params.chain ?? 'xrpl',
      network: params.network ?? 'testnet',
    };
    if (params.chainId !== undefined) {
      toolParams.chain_id = params.chainId;
    }
    const result = await this.transport.callTool('wallet_create', toolParams);
    return normalizeCreateResult(result as Record<string, unknown>);
  }

  /**
   * Check wallet balance. Currently returns NOT_IMPLEMENTED from the server.
   * @param params - Address, chain, and optional chain ID.
   */
  async balance(params: BalanceParams): Promise<ToolCallResult> {
    const toolParams: Record<string, unknown> = {
      address: params.address,
      chain: params.chain ?? 'xrpl',
    };
    if (params.chainId !== undefined) {
      toolParams.chain_id = params.chainId;
    }
    return this.transport.callTool('wallet_balance', toolParams);
  }

  /**
   * List recent transactions for an address. Currently returns NOT_IMPLEMENTED from the server.
   * @param params - Address, chain, optional chain ID and limit.
   */
  async transactions(params: TransactionsParams): Promise<ToolCallResult> {
    const toolParams: Record<string, unknown> = {
      address: params.address,
      chain: params.chain ?? 'xrpl',
      limit: params.limit ?? 20,
    };
    if (params.chainId !== undefined) {
      toolParams.chain_id = params.chainId;
    }
    return this.transport.callTool('wallet_transactions', toolParams);
  }
}

// -- Normalizers (snake_case server response -> camelCase SDK types) --

function normalizeChainInfo(raw: Record<string, unknown>): ChainInfo {
  return {
    chain: raw.chain as string,
    chainFamily: (raw.chain_family as string) ?? (raw.chainFamily as string),
    nativeToken: (raw.native_token as string) ?? (raw.nativeToken as string),
    walletCreation: (raw.wallet_creation as string) ?? (raw.walletCreation as string),
    networks: raw.networks as Record<string, any>,
    supportedChainIds: (raw.supported_chain_ids as number[]) ?? (raw.supportedChainIds as number[]),
    sdkMethod: (raw.sdk_method as string) ?? (raw.sdkMethod as string),
  };
}

function normalizeCreateResult(raw: Record<string, unknown>): WalletCreateResult {
  return {
    address: raw.address as string,
    chain: raw.chain as string,
    network: raw.network as string,
    isFunded: (raw.is_funded as boolean) ?? (raw.isFunded as boolean) ?? false,
    warnings: (raw.warnings as string[]) ?? [],
    secret: raw.secret as string | undefined,
    seedPhrase: (raw.seed_phrase as string | null) ?? (raw.seedPhrase as string | null),
    privateKey: (raw.private_key as string) ?? (raw.privateKey as string),
    chainId: (raw.chain_id as number) ?? (raw.chainId as number),
  };
}
