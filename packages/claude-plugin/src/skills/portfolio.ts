import type { Transport, ToolCallResult } from '@mangrovemarkets/sdk';

export interface PortfolioValueParams {
  action: 'value';
  addresses: string[];
  chain_id: number;
}

export interface PortfolioPnlParams {
  action: 'pnl';
  addresses: string[];
  chain_id: number;
}

export interface PortfolioBalancesParams {
  action: 'balances';
  wallet: string;
  chain_id: number;
}

export type PortfolioParams = PortfolioValueParams | PortfolioPnlParams | PortfolioBalancesParams;

export async function handlePortfolio(
  transport: Transport,
  params: PortfolioParams,
): Promise<ToolCallResult> {
  switch (params.action) {
    case 'value':
      return transport.callTool('oneinch_portfolio_value', {
        addresses: params.addresses,
        chain_id: params.chain_id,
      });

    case 'pnl':
      return transport.callTool('oneinch_portfolio_pnl', {
        addresses: params.addresses,
        chain_id: params.chain_id,
      });

    case 'balances':
      return transport.callTool('oneinch_balances', {
        wallet: params.wallet,
        chain_id: params.chain_id,
      });

    default:
      throw new Error(`Unknown portfolio action: ${(params as { action: string }).action}`);
  }
}
