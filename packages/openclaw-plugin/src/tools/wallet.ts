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
