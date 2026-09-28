import { describe, it, expect, vi } from 'vitest';
import { handleWallet } from '../skills/wallet';
import type { Transport } from '@mangrove-ai/sdk';

function mockTransport(): Transport {
  return {
    callTool: vi.fn().mockImplementation((name: string) => {
      if (name === 'wallet_chain_info') return Promise.resolve({ chain: 'xrpl', network: 'testnet' });
      if (name === 'wallet_balance') return Promise.resolve({ address: '0x1', balance: '100' });
      return Promise.resolve({});
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe('handleWallet', () => {
  it('gets chain info', async () => {
    const transport = mockTransport();
    const result = await handleWallet(transport, { action: 'info', chain: 'xrpl' });
    expect(transport.callTool).toHaveBeenCalledWith('wallet_chain_info', { chain: 'xrpl' });
    expect(result).toHaveProperty('chain', 'xrpl');
  });

  it('rejects wallet creation before generating or exposing a secret', async () => {
    const transport = mockTransport();
    await expect(handleWallet(transport, {
      action: 'create', chain: 'xrpl', network: 'testnet',
    })).rejects.toMatchObject({ code: 'LOCAL_CUSTODY_REQUIRED' });
    expect(transport.callTool).not.toHaveBeenCalled();
  });

  it('also guards the XRPL-specific creation action', async () => {
    const client = { wallet: { createXrplWallet: vi.fn() } };
    await expect(handleWallet(client, { action: 'xrpl_create' }))
      .rejects.toMatchObject({ code: 'LOCAL_CUSTODY_REQUIRED' });
    expect(client.wallet.createXrplWallet).not.toHaveBeenCalled();
  });

  it('checks balance', async () => {
    const transport = mockTransport();
    const result = await handleWallet(transport, {
      action: 'balance',
      address: '0x1',
      chain_id: 8453,
    });
    expect(transport.callTool).toHaveBeenCalledWith('wallet_balance', {
      address: '0x1',
      chain_id: 8453,
    });
    expect(result).toHaveProperty('balance', '100');
  });
});
