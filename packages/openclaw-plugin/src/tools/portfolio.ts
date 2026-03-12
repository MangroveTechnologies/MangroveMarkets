/**
 * Create portfolio tool handlers that delegate to transport.callTool().
 * Uses the transport directly since SDK portfolio services are not yet implemented.
 * @param transport - The MCP transport instance
 * @returns Object with mangrove_portfolio_value, mangrove_portfolio_pnl, and mangrove_portfolio_balances handlers
 */
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
