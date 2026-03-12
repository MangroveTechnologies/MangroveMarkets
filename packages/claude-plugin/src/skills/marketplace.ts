import type { Transport, ToolCallResult } from '@mangrovemarkets/sdk';

export interface MarketplaceSearchParams {
  action: 'search';
  query: string;
  category?: string;
}

export interface MarketplaceGetParams {
  action: 'get';
  listing_id: string;
}

export interface MarketplaceCreateParams {
  action: 'create';
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
}

export type MarketplaceParams = MarketplaceSearchParams | MarketplaceGetParams | MarketplaceCreateParams;

export async function handleMarketplace(
  transport: Transport,
  params: MarketplaceParams,
): Promise<ToolCallResult> {
  switch (params.action) {
    case 'search':
      return transport.callTool('marketplace_search', {
        query: params.query,
        category: params.category,
      });

    case 'get':
      return transport.callTool('marketplace_get_listing', {
        listing_id: params.listing_id,
      });

    case 'create':
      return transport.callTool('marketplace_create_listing', {
        title: params.title,
        description: params.description,
        category: params.category,
        price: params.price,
        currency: params.currency,
      });

    default:
      throw new Error(`Unknown marketplace action: ${(params as { action: string }).action}`);
  }
}
