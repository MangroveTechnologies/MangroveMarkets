import type { MangroveClient, BillingMode, Quote, SwapResult, TransactionStatus } from '@mangrovemarkets/sdk';

export interface SwapQuoteParams {
  action: 'quote';
  src: string;
  dst: string;
  amount: string;
  chainId: number;
  mode?: BillingMode;
}

export interface SwapExecuteParams {
  action: 'execute';
  src: string;
  dst: string;
  amount: string;
  chainId: number;
  slippage?: number;
  mevProtection?: boolean;
  mode?: BillingMode;
}

export interface SwapStatusParams {
  action: 'status';
  txHash: string;
  chainId: number;
}

export type SwapParams = SwapQuoteParams | SwapExecuteParams | SwapStatusParams;

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
        mode: params.mode,
      });

    case 'execute':
      return client.dex.swap({
        src: params.src,
        dst: params.dst,
        amount: params.amount,
        chainId: params.chainId,
        slippage: params.slippage,
        mevProtection: params.mevProtection,
        mode: params.mode,
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
