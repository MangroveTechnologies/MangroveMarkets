/**
 * Create wallet tool handlers that delegate to transport.callTool().
 * Uses the transport directly since SDK wallet services are not yet implemented.
 * @param transport - The MCP transport instance
 * @returns Object with mangrove_wallet_info, mangrove_wallet_create, and mangrove_wallet_balance handlers
 */
export function walletToolHandlers(transport: any) {
  return {
    mangrove_wallet_info: async (params: any) =>
      transport.callTool('wallet_chain_info', params),
    mangrove_wallet_create: async (params: any) =>
      transport.callTool('wallet_create', params),
    mangrove_wallet_balance: async (params: any) =>
      transport.callTool('wallet_balance', params),
  };
}
