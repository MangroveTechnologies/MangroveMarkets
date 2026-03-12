/**
 * Create DEX tool handlers that delegate to the SDK's MangroveClient.
 * Returns an object mapping tool names to async handler functions.
 * @param client - The MangroveClient instance
 * @returns Object with mangrove_dex_quote, mangrove_dex_swap, and mangrove_dex_status handlers
 */
export function dexToolHandlers(client: any) {
  return {
    mangrove_dex_quote: async (params: any) => client.dex.getQuote(params),
    mangrove_dex_swap: async (params: any) => client.dex.swap(params),
    mangrove_dex_status: async (params: any) => client.dex.txStatus(params),
  };
}
