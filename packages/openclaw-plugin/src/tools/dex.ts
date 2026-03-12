export function dexToolHandlers(client: any) {
  return {
    mangrove_dex_quote: async (params: any) => client.dex.getQuote(params),
    mangrove_dex_swap: async (params: any) => client.dex.swap(params),
    mangrove_dex_status: async (params: any) => client.dex.txStatus(params),
  };
}
