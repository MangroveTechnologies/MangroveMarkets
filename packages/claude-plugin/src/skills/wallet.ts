import { LocalWalletCustodyRequiredError } from '@mangrove-ai/sdk';
import type { Transport } from '@mangrove-ai/sdk';

export interface WalletInfoParams { action: 'info'; chain: string; }
export interface WalletCreateParams { action: 'create'; chain: string; chain_id?: number; network?: string; }
export interface WalletBalanceParams { action: 'balance'; address: string; chain_id: number; }

export interface WalletXrplBalanceParams { action: 'xrpl_balance'; address: string; network?: 'testnet' | 'devnet' | 'mainnet'; }
export interface WalletXrplSendParams { action: 'xrpl_send'; fromAddress: string; toAddress: string; amount: string; currency?: string; issuer?: string; network?: string; }
export interface WalletXrplTransactionsParams { action: 'xrpl_transactions'; address: string; limit?: number; network?: string; }
export interface WalletXrplCreateParams { action: 'xrpl_create'; }
export interface WalletXrplFaucetParams { action: 'xrpl_faucet'; address: string; network: 'testnet' | 'devnet'; }

export type WalletParams =
  | WalletInfoParams
  | WalletCreateParams
  | WalletBalanceParams
  | WalletXrplBalanceParams
  | WalletXrplSendParams
  | WalletXrplTransactionsParams
  | WalletXrplCreateParams
  | WalletXrplFaucetParams;

/**
 * Handle a /wallet skill invocation.
 * Legacy info/balance actions use transport directly; creation requires a local custody integration before it can be exposed as an AI tool.
 * XRPL actions use the client.wallet service.
 */
export async function handleWallet(
  clientOrTransport: { wallet: any } | Transport,
  params: WalletParams,
): Promise<unknown> {
  switch (params.action) {
    case 'create':
    case 'xrpl_create':
      throw new LocalWalletCustodyRequiredError();
    case 'info':
    case 'balance': {
      const transport = clientOrTransport as Transport;
      if (params.action === 'info') return transport.callTool('wallet_chain_info', { chain: params.chain });
      return transport.callTool('wallet_balance', { address: params.address, chain_id: params.chain_id });
    }
    case 'xrpl_balance': {
      const client = clientOrTransport as { wallet: any };
      return client.wallet.xrplBalance(params.address, params.network);
    }
    case 'xrpl_send': {
      const client = clientOrTransport as { wallet: any };
      return client.wallet.xrplSend({ fromAddress: params.fromAddress, toAddress: params.toAddress, amount: params.amount, currency: params.currency, issuer: params.issuer, network: params.network });
    }
    case 'xrpl_transactions': {
      const client = clientOrTransport as { wallet: any };
      return client.wallet.xrplTransactions(params.address, { limit: params.limit, network: params.network });
    }
    case 'xrpl_faucet': {
      const client = clientOrTransport as { wallet: any };
      return client.wallet.requestFaucetFunding(params.address, params.network);
    }
    default:
      throw new Error(`Unknown wallet action: ${(params as { action: string }).action}`);
  }
}
