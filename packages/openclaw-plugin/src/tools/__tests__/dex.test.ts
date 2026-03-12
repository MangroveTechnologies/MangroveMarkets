import { describe, it, expect, vi } from 'vitest';
import { dexToolHandlers } from '../dex';

const mockClient = {
  dex: {
    getQuote: vi.fn().mockResolvedValue({ quoteId: 'q-1' }),
    swap: vi.fn().mockResolvedValue({ txHash: '0xabc' }),
    txStatus: vi.fn().mockResolvedValue({ status: 'confirmed' }),
  },
};

describe('dexToolHandlers', () => {
  const handlers = dexToolHandlers(mockClient);

  it('quote handler calls client.dex.getQuote', async () => {
    const result = await handlers.mangrove_dex_quote({ src: 'USDC', dst: 'ETH', amount: '1000', chainId: 8453 });
    expect(result.quoteId).toBe('q-1');
    expect(mockClient.dex.getQuote).toHaveBeenCalled();
  });

  it('swap handler calls client.dex.swap', async () => {
    const result = await handlers.mangrove_dex_swap({ src: 'USDC', dst: 'ETH', amount: '1000', chainId: 8453 });
    expect(result.txHash).toBe('0xabc');
  });

  it('status handler calls client.dex.txStatus', async () => {
    const result = await handlers.mangrove_dex_status({ txHash: '0xabc', chainId: 8453 });
    expect(result.status).toBe('confirmed');
  });
});
