import { describe, it, expect, vi } from 'vitest';
import { handleMarketplace } from '../skills/marketplace';
import type { Transport } from '@mangrovemarkets/sdk';

function mockTransport(): Transport {
  return {
    callTool: vi.fn().mockImplementation((name: string) => {
      if (name === 'marketplace_search') return Promise.resolve({ listings: [{ id: '1' }] });
      if (name === 'marketplace_get_listing') return Promise.resolve({ id: '1', title: 'Test' });
      if (name === 'marketplace_create_listing') return Promise.resolve({ id: '2', title: 'New' });
      return Promise.resolve({});
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe('handleMarketplace', () => {
  it('searches listings', async () => {
    const transport = mockTransport();
    const result = await handleMarketplace(transport, {
      action: 'search',
      query: 'data feeds',
      category: 'data',
    });
    expect(transport.callTool).toHaveBeenCalledWith('marketplace_search', {
      query: 'data feeds',
      category: 'data',
    });
    expect(result).toHaveProperty('listings');
  });

  it('gets a listing', async () => {
    const transport = mockTransport();
    const result = await handleMarketplace(transport, {
      action: 'get',
      listing_id: '1',
    });
    expect(transport.callTool).toHaveBeenCalledWith('marketplace_get_listing', {
      listing_id: '1',
    });
    expect(result).toHaveProperty('title', 'Test');
  });

  it('creates a listing', async () => {
    const transport = mockTransport();
    const result = await handleMarketplace(transport, {
      action: 'create',
      title: 'New',
      description: 'A new listing',
      category: 'data',
      price: 10,
      currency: 'XRP',
    });
    expect(transport.callTool).toHaveBeenCalledWith('marketplace_create_listing', {
      title: 'New',
      description: 'A new listing',
      category: 'data',
      price: 10,
      currency: 'XRP',
    });
    expect(result).toHaveProperty('title', 'New');
  });
});
