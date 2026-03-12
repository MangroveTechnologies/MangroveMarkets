export function portfolioToolHandlers(transport: any) {
  return {
    mangrove_portfolio_value: async (params: any) =>
      transport.callTool('oneinch_portfolio_value', params),
    mangrove_portfolio_pnl: async (params: any) =>
      transport.callTool('oneinch_portfolio_pnl', params),
    mangrove_portfolio_balances: async (params: any) =>
      transport.callTool('oneinch_balances', params),
  };
}
