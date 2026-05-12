/**
 * Create wallet tool handlers delegating to the MangroveClient's wallet service.
 * @param client - The MangroveClient instance
 * @returns Object mapping tool names to async handler functions
 */
export function walletToolHandlers(client: any) {
  return {
    mangrove_wallet_info: async (params: any) =>
      client.wallet.chainInfo({ chain: params.chain }),
    mangrove_wallet_create: async (params: any) =>
      client.wallet.create({ chain: params.chain, chainId: params.chain_id, network: params.network }),
    mangrove_wallet_balance: async (params: any) =>
      client.wallet.balance({ address: params.address, chainId: params.chain_id }),
    mangrove_xrpl_balance: async (params: any) =>
      client.wallet.xrplBalance(params.address, params.network),
    mangrove_xrpl_send: async (params: any) =>
      client.wallet.xrplSend(params),
    mangrove_xrpl_transactions: async (params: any) =>
      client.wallet.xrplTransactions(params.address, params),
    mangrove_xrpl_create: async (_params: any) =>
      client.wallet.createXrplWallet(),
    mangrove_xrpl_faucet: async (params: any) =>
      client.wallet.requestFaucetFunding(params.address, params.network),
  };
}
