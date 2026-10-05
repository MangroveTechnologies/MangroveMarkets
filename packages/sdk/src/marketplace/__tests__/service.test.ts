import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceService } from '../service';
import { MockTransport } from '../../transport/__tests__/mock';

describe('MarketplaceService', () => {
  let transport: MockTransport;
  let marketplace: MarketplaceService;

  beforeEach(() => {
    transport = new MockTransport();
    marketplace = new MarketplaceService(transport);
  });

  it('createListing sends correct snake_case params and normalizes response', async () => {
    transport.addResponse('marketplace_create_listing', {
      listing_id: 'lst-001',
      status: 'active',
      created_at: '2026-03-12T10:00:00Z',
    } as any);

    const result = await marketplace.createListing({
      sellerAddress: 'rXRPAddress123',
      title: 'Market Data Feed',
      description: 'Real-time crypto prices',
      category: 'data',
      priceXrp: 10.5,
      listingType: 'static',
      tags: ['crypto', 'realtime'],
    });

    expect(result.listingId).toBe('lst-001');
    expect(result.status).toBe('active');
    expect(result.createdAt).toBe('2026-03-12T10:00:00Z');

    const call = transport.calls[0];
    expect(call.name).toBe('marketplace_create_listing');
    expect(call.params.seller_address).toBe('rXRPAddress123');
    expect(call.params.title).toBe('Market Data Feed');
    expect(call.params.price_xrp).toBe(10.5);
    expect(call.params.listing_type).toBe('static');
    expect(call.params.tags).toEqual(['crypto', 'realtime']);
  });

  it('search sends filters as snake_case and normalizes SearchResult', async () => {
    transport.addResponse('marketplace_search', {
      listings: [
        {
          listing_id: 'lst-001',
          seller_address: 'rAddr1',
          title: 'Data Feed',
          description: 'Prices',
          category: 'data',
          price: { amount: 5, currency: 'USDC', chain: 'base' },
          listing_type: 'static',
          tags: ['crypto'],
          created_at: '2026-03-12T10:00:00Z',
        },
      ],
      total_count: 1,
      next_cursor: null,
    } as any);

    const result = await marketplace.search({
      query: 'data',
      category: 'data',
      minPrice: 1,
      maxPrice: 100,
      limit: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(result.nextCursor).toBeNull();
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].listingId).toBe('lst-001');
    expect(result.listings[0].sellerAddress).toBe('rAddr1');
    expect(result.listings[0].price).toEqual({ amount: 5, currency: 'USDC', chain: 'base', network: null });
    expect(result.listings[0]).not.toHaveProperty('priceXrp');

    const call = transport.calls[0];
    expect(call.name).toBe('marketplace_search');
    expect(call.params.query).toBe('data');
    expect(call.params.min_price).toBe(1);
    expect(call.params.max_price).toBe(100);
    expect(call.params.limit).toBe(10);
  });

  it('getListing normalizes full listing response', async () => {
    transport.addResponse('marketplace_get_listing', {
      listing_id: 'lst-002',
      seller_address: 'rSeller',
      title: 'Compute Service',
      description: 'GPU inference',
      category: 'compute',
      subcategory: 'gpu',
      price: { amount: 25, currency: 'XRP', chain: 'xrpl' },
      listing_type: 'service',
      status: 'active',
      tags: ['gpu', 'inference'],
      storage_uri: 'ipfs://Qm123',
      content_hash: 'sha256:abc',
      created_at: '2026-03-12T10:00:00Z',
      updated_at: '2026-03-12T11:00:00Z',
      expires_at: null,
    } as any);

    const listing = await marketplace.getListing('lst-002');

    expect(listing.listingId).toBe('lst-002');
    expect(listing.sellerAddress).toBe('rSeller');
    expect(listing.category).toBe('compute');
    expect(listing.subcategory).toBe('gpu');
    expect(listing.price).toEqual({ amount: 25, currency: 'XRP', chain: 'xrpl', network: null });
    expect(listing.listingType).toBe('service');
    expect(listing.storageUri).toBe('ipfs://Qm123');
    expect(listing.contentHash).toBe('sha256:abc');
    expect(listing.expiresAt).toBeNull();

    expect(transport.calls[0].name).toBe('marketplace_get_listing');
    expect(transport.calls[0].params.listing_id).toBe('lst-002');
  });

  it('uses the qualified price even when a legacy amount is present', async () => {
    transport.addResponse('marketplace_get_listing', {
      listing_id: 'lst-003',
      price: { amount: 2, currency: 'USDC', chain: 'base' },
      price_xrp: 99,
    } as any);

    const listing = await marketplace.getListing('lst-003');

    expect(listing.price).toEqual({ amount: 2, currency: 'USDC', chain: 'base', network: null });
    expect(listing).not.toHaveProperty('priceXrp');
  });

  it.each([
    {},
    { price_xrp: 2 },
    { price: null },
    { price: { amount: 2, currency: 'USDC' } },
    { price: { amount: '2', currency: 'USDC', chain: 'base' } },
    { price: { amount: NaN, currency: 'USDC', chain: 'base' } },
    { price: { amount: Infinity, currency: 'USDC', chain: 'base' } },
    { price: { amount: 2, currency: '', chain: 'base' } },
    { price: { amount: 2, currency: 'USDC', chain: ' ' } },
  ])('rejects missing or malformed price instead of inventing a price: %j', async (raw) => {
    transport.addResponse('marketplace_get_listing', raw as any);
    await expect(marketplace.getListing('lst-003')).rejects.toThrow(TypeError);
  });

  it('makeOffer sends listing_id and buyer_address', async () => {
    transport.addResponse('marketplace_make_offer', {
      error: true,
      code: 'NOT_IMPLEMENTED',
      message: 'marketplace_make_offer not yet implemented',
      suggestion: 'Coming in Phase 3',
    } as any);

    const result = await marketplace.makeOffer({
      listingId: 'lst-001',
      buyerAddress: 'rBuyer',
    });

    expect(transport.calls[0].name).toBe('marketplace_make_offer');
    expect(transport.calls[0].params.listing_id).toBe('lst-001');
    expect(transport.calls[0].params.buyer_address).toBe('rBuyer');
    expect((result as any).code).toBe('NOT_IMPLEMENTED');
  });

  it('acceptOffer sends offer_id and seller_address', async () => {
    transport.addResponse('marketplace_accept_offer', {
      error: true,
      code: 'NOT_IMPLEMENTED',
      message: 'marketplace_accept_offer not yet implemented',
      suggestion: 'Coming in Phase 3',
    } as any);

    const result = await marketplace.acceptOffer({
      offerId: 'off-001',
      sellerAddress: 'rSeller',
    });

    expect(transport.calls[0].name).toBe('marketplace_accept_offer');
    expect(transport.calls[0].params.offer_id).toBe('off-001');
    expect(transport.calls[0].params.seller_address).toBe('rSeller');
    expect((result as any).code).toBe('NOT_IMPLEMENTED');
  });

  it('confirmDelivery sends offer_id and buyer_address', async () => {
    transport.addResponse('marketplace_confirm_delivery', {
      error: true,
      code: 'NOT_IMPLEMENTED',
      message: 'marketplace_confirm_delivery not yet implemented',
      suggestion: 'Coming in Phase 3',
    } as any);

    const result = await marketplace.confirmDelivery({
      offerId: 'off-001',
      buyerAddress: 'rBuyer',
    });

    expect(transport.calls[0].name).toBe('marketplace_confirm_delivery');
    expect(transport.calls[0].params.offer_id).toBe('off-001');
    expect(transport.calls[0].params.buyer_address).toBe('rBuyer');
    expect((result as any).code).toBe('NOT_IMPLEMENTED');
  });

  it('rate sends score and optional comment', async () => {
    transport.addResponse('marketplace_rate', {
      error: true,
      code: 'NOT_IMPLEMENTED',
      message: 'marketplace_rate not yet implemented',
      suggestion: 'Coming in Phase 3',
    } as any);

    const result = await marketplace.rate({
      offerId: 'off-001',
      raterAddress: 'rBuyer',
      score: 5,
      comment: 'Great service!',
    });

    expect(transport.calls[0].name).toBe('marketplace_rate');
    expect(transport.calls[0].params.offer_id).toBe('off-001');
    expect(transport.calls[0].params.rater_address).toBe('rBuyer');
    expect(transport.calls[0].params.score).toBe(5);
    expect(transport.calls[0].params.comment).toBe('Great service!');
    expect((result as any).code).toBe('NOT_IMPLEMENTED');
  });
});


describe('settlement network normalization', () => {
  it.each(['eip155:8453', 'eip155:84532', 'xrpl:testnet', null])('preserves %s', async (network) => {
    const { normalizeListing } = await import('../../utils/normalize');
    const listing = normalizeListing({ price: { amount: 1, currency: 'USDC', chain: 'base', network } });
    expect(listing.price.network).toBe(network);
  });
  it.each(['', ' ', 8453, {}])('rejects malformed network %j', async (network) => {
    const { normalizeListing } = await import('../../utils/normalize');
    expect(() => normalizeListing({ price: { amount: 1, currency: 'USDC', chain: 'base', network } })).toThrow(TypeError);
  });
});
