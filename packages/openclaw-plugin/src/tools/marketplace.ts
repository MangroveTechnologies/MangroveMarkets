/**
 * Create marketplace tool handlers that delegate to transport.callTool().
 * Uses the transport directly since SDK marketplace services are not yet implemented.
 * @param transport - The MCP transport instance
 * @returns Object with mangrove_marketplace_search, mangrove_marketplace_get, and mangrove_marketplace_create handlers
 */
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
