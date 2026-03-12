import { describe, it, expect, vi } from 'vitest';
import { handleSwap } from '../skills/swap';
import type { MangroveClient } from '@mangrovemarkets/sdk';

function mockClient() {
  return {
    dex: {
      getQuote: vi.fn().mockResolvedValue({ quoteId: 'q-123', outputAmount: '1000' }),
      swap: vi.fn().mockResolvedValue({ txHash: '0xabc', status: 'confirmed' }),
      txStatus: vi.fn().mockResolvedValue({ txHash: '0xabc', status: 'confirmed', chainId: 8453 }),
    },
  } as unknown as MangroveClient;
}

describe('handleSwap', () => {
  it('returns a quote', async () => {
    const client = mockClient();
    const result = await handleSwap(client, {
      action: 'quote',
      src: '0xA',
      dst: '0xB',
      amount: '1000000',
      chainId: 8453,
    });
    expect(client.dex.getQuote).toHaveBeenCalledWith({
      src: '0xA',
      dst: '0xB',
      amount: '1000000',
      chainId: 8453,
      mode: undefined,
    });
    expect(result).toHaveProperty('quoteId', 'q-123');
  });

  it('executes a swap', async () => {
    const client = mockClient();
    const result = await handleSwap(client, {
      action: 'execute',
      src: '0xA',
      dst: '0xB',
      amount: '1000000',
      chainId: 8453,
    });
    expect(client.dex.swap).toHaveBeenCalled();
    expect(result).toHaveProperty('txHash', '0xabc');
  });

  it('checks transaction status', async () => {
    const client = mockClient();
    const result = await handleSwap(client, {
      action: 'status',
      txHash: '0xabc',
      chainId: 8453,
    });
    expect(client.dex.txStatus).toHaveBeenCalledWith({ txHash: '0xabc', chainId: 8453 });
    expect(result).toHaveProperty('status', 'confirmed');
  });

  it('throws on unknown action', async () => {
    const client = mockClient();
    await expect(
      handleSwap(client, { action: 'unknown' } as never),
    ).rejects.toThrow('Unknown swap action: unknown');
  });
});
