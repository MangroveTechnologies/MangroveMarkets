import type { Transport, ToolCallResult } from '@mangrove-ai/sdk';

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

/**
 * Handle a /portfolio skill invocation. Uses transport.callTool() directly
 * since SDK portfolio services are not yet implemented.
 * @param transport - The MCP transport instance
 * @param params - Portfolio parameters including the action discriminator
 * @returns Tool call result from the MCP server
 */
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
