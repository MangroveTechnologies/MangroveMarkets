export function marketplaceToolHandlers(transport: any) {
  return {
    mangrove_marketplace_search: async (params: any) =>
      transport.callTool('marketplace_search', params),
    mangrove_marketplace_get: async (params: any) =>
      transport.callTool('marketplace_get_listing', { listing_id: params.listingId }),
    mangrove_marketplace_create: async (params: any) =>
      transport.callTool('marketplace_create_listing', params),
  };
}
