import type { Transport, ToolCallResult } from '@mangrovemarkets/sdk';

export interface WalletInfoParams {
  action: 'info';
  chain: string;
}

export interface WalletCreateParams {
  action: 'create';
  chain: string;
  chain_id?: number;
  network?: string;
}

export interface WalletBalanceParams {
  action: 'balance';
  address: string;
  chain_id: number;
}

export type WalletParams = WalletInfoParams | WalletCreateParams | WalletBalanceParams;

export async function handleWallet(
  transport: Transport,
  params: WalletParams,
): Promise<ToolCallResult> {
  switch (params.action) {
    case 'info':
      return transport.callTool('wallet_chain_info', {
        chain: params.chain,
      });

    case 'create':
      return transport.callTool('wallet_create', {
        chain: params.chain,
        chain_id: params.chain_id,
        network: params.network,
      });

    case 'balance':
      return transport.callTool('wallet_balance', {
        address: params.address,
        chain_id: params.chain_id,
      });

    default:
      throw new Error(`Unknown wallet action: ${(params as { action: string }).action}`);
  }
}
