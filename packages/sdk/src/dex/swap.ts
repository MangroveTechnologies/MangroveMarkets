import type { Signer } from '../types/signer';
import type { SwapParams, SwapResult, TransactionStatus } from '../types/dex';
import type { Transport } from '../types/transport';
import { DexService } from './service';

const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 60;

/**
 * High-level swap executor. Handles the full flow:
 * quote -> check allowance -> approve if needed -> sign -> broadcast -> poll for confirmation.
 */
export class SwapOrchestrator {
  private dex: DexService;
  private signer: Signer;
  private transport: Transport;

  constructor(dex: DexService, signer: Signer, transport: Transport) {
    this.dex = dex;
    this.signer = signer;
    this.transport = transport;
  }

  /**
   * Execute a full swap from quote through on-chain confirmation.
   *
   * Flow: get quote -> check ERC-20 allowance (skip for native tokens) ->
   * approve if needed -> prepare unsigned swap tx -> sign locally ->
   * broadcast -> poll until confirmed or failed.
   *
   * @param params - Swap parameters (src, dst, amount, chainId, slippage, mevProtection, mode).
   * @returns Final swap result including tx hash, status, and amounts.
   * @throws If the transaction does not confirm within the polling timeout.
   */
  async swap(params: SwapParams): Promise<SwapResult> {
    const slippage = params.slippage ?? 0.5;
    const mevProtection = params.mevProtection ?? false;
    const mode = params.mode ?? 'standard';

    // 1. Get quote
    const quote = await this.dex.getQuote({
      src: params.src,
      dst: params.dst,
      amount: params.amount,
      chainId: params.chainId,
      mode,
    });

    // 2. Check quote expiry
    if (quote.expiresAt) {
      const expiry = new Date(quote.expiresAt);
      if (!isNaN(expiry.getTime()) && expiry < new Date()) {
        throw new Error(`Quote ${quote.quoteId} expired at ${quote.expiresAt}. Re-fetch a fresh quote.`);
      }
    }

    // 3. Check if approval needed (skip for native tokens)
    const isNativeToken = params.src.toLowerCase() === NATIVE_TOKEN.toLowerCase();
    if (!isNativeToken) {
      const needsApproval = await this.checkNeedsApproval(params.src, params.chainId);
      if (needsApproval) {
        await this.approveAndWait(params.src, params.chainId);
      }
    }

    // 4. Prepare swap
    const walletAddress = await this.signer.getAddress();
    const unsignedTx = await this.dex.prepareSwap({ quoteId: quote.quoteId, walletAddress, slippage });

    // 5. Sign
    const signedTx = await this.signer.signTransaction(unsignedTx);

    // 6. Broadcast
    const broadcastResult = await this.dex.broadcast({
      chainId: params.chainId,
      signedTx,
      mevProtection,
    });

    // 7. Poll for confirmation
    const status = await this.pollStatus(broadcastResult.txHash, params.chainId);

    return {
      txHash: broadcastResult.txHash,
      chainId: params.chainId,
      status: status.status as 'confirmed' | 'failed',
      gasUsed: status.gasUsed || '0',
      inputToken: quote.inputToken,
      outputToken: quote.outputToken,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
    };
  }

  private async checkNeedsApproval(tokenAddress: string, chainId: number): Promise<boolean> {
    const walletAddress = await this.signer.getAddress();
    const result = await this.transport.callTool('oneinch_allowances', {
      chain_id: chainId,
      wallet_address: walletAddress,
      spender: 'router',
    });

    // Server returns {allowances: {tokenAddress: amount}} or flat {tokenAddress: amount}
    const raw = result as Record<string, unknown>;
    const allowanceMap = (typeof raw.allowances === 'object' && raw.allowances !== null)
      ? raw.allowances as Record<string, string>
      : raw as Record<string, string>;

    const value = allowanceMap[tokenAddress];
    if (value === undefined || value === null || value === '0') {
      return true;
    }

    try {
      return BigInt(value) === 0n;
    } catch {
      // Non-numeric allowance value -- cannot determine, re-approve to be safe
      return true;
    }
  }

  private async approveAndWait(tokenAddress: string, chainId: number): Promise<void> {
    const walletAddress = await this.signer.getAddress();
    const approveTx = await this.dex.approveToken({ tokenAddress, chainId, walletAddress });
    const signedApproval = await this.signer.signTransaction(approveTx);
    const approvalBroadcast = await this.dex.broadcast({
      chainId,
      signedTx: signedApproval,
    });
    const status = await this.pollStatus(approvalBroadcast.txHash, chainId);
    if (status.status === 'failed') {
      throw new Error(`Approval transaction failed on-chain: ${approvalBroadcast.txHash}`);
    }
  }

  private async pollStatus(txHash: string, chainId: number): Promise<TransactionStatus> {
    for (let i = 0; i < MAX_POLLS; i++) {
      const status = await this.dex.txStatus({ txHash, chainId });
      if (status.status === 'confirmed' || status.status === 'failed') {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error(`Transaction ${txHash} did not confirm within ${MAX_POLLS * POLL_INTERVAL_MS / 1000}s`);
  }
}
