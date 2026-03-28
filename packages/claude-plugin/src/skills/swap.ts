import type { MangroveClient, Quote, SwapResult, TransactionStatus } from '@mangrove-ai/sdk';

export interface SwapQuoteParams {
  action: 'quote';
  src: string;
  dst: string;
  amount: string;
  chainId: number;
}

export interface SwapExecuteParams {
  action: 'execute';
  src: string;
  dst: string;
  amount: string;
  chainId: number;
  slippage?: number;
  mevProtection?: boolean;
}

export interface SwapStatusParams {
  action: 'status';
  txHash: string;
  chainId: number;
}

export type SwapParams = SwapQuoteParams | SwapExecuteParams | SwapStatusParams;

/**
 * Handle a /swap skill invocation. Dispatches to the appropriate SDK DEX method
 * based on the action: quote, execute, or status.
 * @param client - The MangroveClient instance
 * @param params - Swap parameters including the action discriminator
 * @returns Quote, SwapResult, or TransactionStatus depending on the action
 */
export async function handleSwap(
  client: MangroveClient,
  params: SwapParams,
): Promise<Quote | SwapResult | TransactionStatus> {
  switch (params.action) {
    case 'quote':
      return client.dex.getQuote({
        src: params.src,
        dst: params.dst,
        amount: params.amount,
        chainId: params.chainId,
      });

    case 'execute':
      return client.dex.swap({
        src: params.src,
        dst: params.dst,
        amount: params.amount,
        chainId: params.chainId,
        slippage: params.slippage,
        mevProtection: params.mevProtection,
      });

    case 'status':
      return client.dex.txStatus({
        txHash: params.txHash,
        chainId: params.chainId,
      });

    default:
      throw new Error(`Unknown swap action: ${(params as { action: string }).action}`);
  }
}
