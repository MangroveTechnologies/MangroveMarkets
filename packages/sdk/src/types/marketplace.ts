/**
 * TypeScript types for the Mangrove Marketplace domain.
 *
 * Maps to the Python server's marketplace models (Listing, Offer, Rating)
 * with camelCase naming per TypeScript convention.
 */

// -- Enums (matching server's ListingType, ListingStatus, OfferStatus, Category) --

export type ListingType = 'static' | 'service';

export type ListingStatus =
  | 'draft'
  | 'active'
  | 'offered'
  | 'escrowed'
  | 'delivered'
  | 'completed'
  | 'rated'
  | 'cancelled';

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

export type Category =
  | 'data'
  | 'compute'
  | 'intelligence'
  | 'models'
  | 'apis'
  | 'storage'
  | 'identity'
  | 'media'
  | 'code'
  | 'other';

// -- Domain objects --

/** A marketplace listing as returned by the server. */
export interface Listing {
  listingId: string;
  sellerAddress: string;
  title: string;
  description: string;
  category: Category;
  subcategory?: string | null;
  priceXrp: number;
  listingType: ListingType;
  status: ListingStatus;
  tags: string[];
  storageUri?: string | null;
  contentHash?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
}

/** An offer on a marketplace listing. */
export interface Offer {
  id: string;
  listingId: string;
  buyerAddress: string;
  amountXrp: number;
  status: OfferStatus;
}

/** A rating for a completed marketplace transaction. */
export interface Rating {
  id: string;
  listingId: string;
  score: number;
  comment?: string | null;
}

/** Paginated search results from marketplace_search. */
export interface SearchResult {
  listings: Listing[];
  totalCount: number;
  nextCursor: string | null;
}

// -- Parameter types --

/** Parameters for marketplace_create_listing. */
export interface CreateListingParams {
  sellerAddress: string;
  title: string;
  description: string;
  category: string;
  priceXrp: number;
  listingType?: ListingType;
  storageUri?: string;
  contentHash?: string;
  subcategory?: string;
  tags?: string[];
}

/** Parameters for marketplace_search. */
export interface SearchParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  listingType?: string;
  limit?: number;
}

/** Parameters for marketplace_make_offer. */
export interface MakeOfferParams {
  listingId: string;
  buyerAddress: string;
}

/** Parameters for marketplace_accept_offer. */
export interface AcceptOfferParams {
  offerId: string;
  sellerAddress: string;
}

/** Parameters for marketplace_confirm_delivery. */
export interface ConfirmDeliveryParams {
  offerId: string;
  buyerAddress: string;
}

/** Parameters for marketplace_rate. */
export interface RateParams {
  offerId: string;
  raterAddress: string;
  score: number;
  comment?: string;
}

/** Compact create-listing response from the server. */
export interface CreateListingResult {
  listingId: string;
  status: ListingStatus;
  createdAt: string;
}
