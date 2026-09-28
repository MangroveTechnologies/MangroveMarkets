import { Wallet } from 'xrpl';
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
  XrplBalance,
  XrplSendParams,
  XrplTransactionHistory,
  XrplFaucetResult,
} from '../types/wallet';
import type { UnsignedTransaction } from '../types/dex';
import {
  normalizeXrplBalance,
  normalizeXrplTransactionHistory,
  normalizeXrplFaucetResult,
  normalizeXrplUnsignedTx,
} from '../utils/normalize';

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
   * Create an unfunded wallet locally. No network call or automatic faucet funding.
   * EVM requires optional ethers v6; XRPL uses the bundled xrpl library.
   * @param params - Chain, network, and optional chain ID.
   */
  async create(params: CreateWalletParams = {}): Promise<WalletCreateResult> {
    const chain = (params.chain ?? 'xrpl').toLowerCase();
    const network = params.network ?? 'testnet';
    if (!['xrpl', 'evm'].includes(chain)) {
      throw new Error(`Unsupported local wallet chain: ${chain}`);
    }
    if (chain === 'xrpl' && !['mainnet', 'testnet', 'devnet'].includes(network)) {
      throw new Error('XRPL network must be mainnet, testnet or devnet');
    }
    if (params.chainId !== undefined &&
        (!Number.isSafeInteger(params.chainId) || params.chainId <= 0 || chain !== 'evm')) {
      throw new Error('chainId must be a positive safe integer for EVM wallets only');
    }
    const base = {
      chain, network, isFunded: false,
      warnings: ['Save your wallet secret securely. It is generated locally and is not stored by Mangrove.'],
    };
    if (chain === 'xrpl') {
      const wallet = Wallet.generate();
      return { ...base, address: wallet.classicAddress, secret: wallet.seed!, seedPhrase: null };
    }
    let ethers: typeof import('ethers');
    try { ethers = await import('ethers'); } catch {
      throw new Error('Local EVM wallet creation requires the optional ethers dependency: install ethers@^6');
    }
    const wallet = ethers.Wallet.createRandom();
    return { ...base, address: wallet.address, privateKey: wallet.privateKey,
      ...(params.chainId !== undefined ? { chainId: params.chainId } : {}) };
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

  /**
   * Generate a new XRPL wallet client-side. Never touches the wire.
   * @returns Address, seed, and public key. Agent must store the seed securely.
   */
  createXrplWallet(): { address: string; seed: string; publicKey: string } {
    const wallet = Wallet.generate();
    return {
      address: wallet.classicAddress,
      seed: wallet.seed!,
      publicKey: wallet.publicKey,
    };
  }

  /**
   * Get XRPL wallet balance including XRP and issued currencies.
   * @param address - XRPL classic address.
   * @param network - Network to query (testnet, devnet, mainnet).
   */
  async xrplBalance(address: string, network?: "testnet" | "devnet" | "mainnet"): Promise<XrplBalance> {
    const result = await this.transport.callTool('wallet_xrpl_balance', {
      address,
      ...(network ? { network } : {}),
    });
    return normalizeXrplBalance(result as Record<string, unknown>);
  }

  /**
   * Prepare an XRPL send transaction (unsigned). Agent signs with XrplSigner.
   * @param params - Send parameters (from, to, amount, optional currency/issuer/network).
   */
  async xrplSend(params: XrplSendParams): Promise<{ unsignedTx: UnsignedTransaction; signingInstructions: string }> {
    const result = await this.transport.callTool('wallet_xrpl_send', {
      from_address: params.fromAddress,
      to_address: params.toAddress,
      amount: params.amount,
      ...(params.currency ? { currency: params.currency } : {}),
      ...(params.issuer ? { issuer: params.issuer } : {}),
      ...(params.network ? { network: params.network } : {}),
    });
    const raw = result as Record<string, unknown>;
    return {
      unsignedTx: normalizeXrplUnsignedTx(raw),
      signingInstructions: String(raw.signing_instructions ?? ''),
    };
  }

  /**
   * Fetch XRPL transaction history for an address.
   * @param address - XRPL classic address.
   * @param options - Optional limit and network filter.
   */
  async xrplTransactions(address: string, options?: { limit?: number; network?: string }): Promise<XrplTransactionHistory> {
    const result = await this.transport.callTool('wallet_xrpl_transactions', {
      address,
      ...(options?.limit ? { limit: options.limit } : {}),
      ...(options?.network ? { network: options.network } : {}),
    });
    return normalizeXrplTransactionHistory(result as Record<string, unknown>);
  }

  /**
   * Request testnet/devnet faucet funding for an XRPL address.
   * @param address - XRPL classic address to fund.
   * @param network - Must be testnet or devnet (mainnet has no faucet).
   */
  async requestFaucetFunding(address: string, network: "testnet" | "devnet"): Promise<XrplFaucetResult> {
    const result = await this.transport.callTool('xrpl_request_faucet_funding', {
      address,
      network,
    });
    return normalizeXrplFaucetResult(result as Record<string, unknown>);
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
