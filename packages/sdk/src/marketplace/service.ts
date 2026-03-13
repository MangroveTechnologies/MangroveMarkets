import type { Transport, ToolCallResult } from '../types/transport';
import type {
  CreateListingParams,
  CreateListingResult,
  SearchParams,
  SearchResult,
  Listing,
  MakeOfferParams,
  AcceptOfferParams,
  ConfirmDeliveryParams,
  RateParams,
} from '../types/marketplace';
import { normalizeCreateListingResult, normalizeListing, normalizeSearchResult } from '../utils/normalize';

/**
 * Low-level Marketplace service wrapping the marketplace_* MCP tools.
 * Each method maps 1:1 to a server tool, converting camelCase SDK params
 * to the snake_case wire format expected by the Python server.
 */
export class MarketplaceService {
  constructor(private transport: Transport) {}

  /**
   * Create a new listing on the Mangrove Marketplace.
   * @param params - Listing details (seller address, title, category, price, etc.).
   * @returns Compact result with listing ID, status, and creation timestamp.
   */
  async createListing(params: CreateListingParams): Promise<CreateListingResult> {
    const result = await this.transport.callTool('marketplace_create_listing', {
      seller_address: params.sellerAddress,
      title: params.title,
      description: params.description,
      category: params.category,
      price_xrp: params.priceXrp,
      ...(params.listingType ? { listing_type: params.listingType } : {}),
      ...(params.storageUri ? { storage_uri: params.storageUri } : {}),
      ...(params.contentHash ? { content_hash: params.contentHash } : {}),
      ...(params.subcategory ? { subcategory: params.subcategory } : {}),
      ...(params.tags ? { tags: params.tags } : {}),
    });
    return normalizeCreateListingResult(result as Record<string, unknown>);
  }

  /**
   * Search the Mangrove Marketplace for listings.
   * @param params - Optional filters (query, category, price range, type, limit).
   * @returns Paginated search results with listings and total count.
   */
  async search(params: SearchParams = {}): Promise<SearchResult> {
    const result = await this.transport.callTool('marketplace_search', {
      ...(params.query != null ? { query: params.query } : {}),
      ...(params.category != null ? { category: params.category } : {}),
      ...(params.minPrice != null ? { min_price: params.minPrice } : {}),
      ...(params.maxPrice != null ? { max_price: params.maxPrice } : {}),
      ...(params.listingType != null ? { listing_type: params.listingType } : {}),
      ...(params.limit != null ? { limit: params.limit } : {}),
    });
    return normalizeSearchResult(result as Record<string, unknown>);
  }

  /**
   * Get full details of a specific listing by ID.
   * @param listingId - The listing's unique identifier.
   * @returns Full listing details.
   */
  async getListing(listingId: string): Promise<Listing> {
    const result = await this.transport.callTool('marketplace_get_listing', {
      listing_id: listingId,
    });
    return normalizeListing(result as Record<string, unknown>);
  }

  /**
   * Make an offer on a marketplace listing.
   * Note: This tool is a stub on the server (returns NOT_IMPLEMENTED).
   * @param params - Listing ID and buyer address.
   * @returns Raw server response.
   */
  async makeOffer(params: MakeOfferParams): Promise<ToolCallResult> {
    return this.transport.callTool('marketplace_make_offer', {
      listing_id: params.listingId,
      buyer_address: params.buyerAddress,
    });
  }

  /**
   * Accept an offer, creating XRPL escrow.
   * Note: This tool is a stub on the server (returns NOT_IMPLEMENTED).
   * @param params - Offer ID and seller address.
   * @returns Raw server response.
   */
  async acceptOffer(params: AcceptOfferParams): Promise<ToolCallResult> {
    return this.transport.callTool('marketplace_accept_offer', {
      offer_id: params.offerId,
      seller_address: params.sellerAddress,
    });
  }

  /**
   * Confirm delivery and release escrow to seller.
   * Note: This tool is a stub on the server (returns NOT_IMPLEMENTED).
   * @param params - Offer ID and buyer address.
   * @returns Raw server response.
   */
  async confirmDelivery(params: ConfirmDeliveryParams): Promise<ToolCallResult> {
    return this.transport.callTool('marketplace_confirm_delivery', {
      offer_id: params.offerId,
      buyer_address: params.buyerAddress,
    });
  }

  /**
   * Rate a completed marketplace transaction.
   * Note: This tool is a stub on the server (returns NOT_IMPLEMENTED).
   * @param params - Offer ID, rater address, score (1-5), optional comment.
   * @returns Raw server response.
   */
  async rate(params: RateParams): Promise<ToolCallResult> {
    return this.transport.callTool('marketplace_rate', {
      offer_id: params.offerId,
      rater_address: params.raterAddress,
      score: params.score,
      ...(params.comment != null ? { comment: params.comment } : {}),
    });
  }
}
