import { describe, it, expect, vi } from 'vitest';
import { handleWallet } from '../skills/wallet';
import type { Transport } from '@mangrovemarkets/sdk';

function mockTransport(): Transport {
  return {
    callTool: vi.fn().mockImplementation((name: string) => {
      if (name === 'wallet_chain_info') return Promise.resolve({ chain: 'xrpl', network: 'testnet' });
      if (name === 'wallet_create') return Promise.resolve({ address: 'rXXX', chain: 'xrpl' });
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

  it('creates a wallet', async () => {
    const transport = mockTransport();
    const result = await handleWallet(transport, {
      action: 'create',
      chain: 'xrpl',
      network: 'testnet',
    });
    expect(transport.callTool).toHaveBeenCalledWith('wallet_create', {
      chain: 'xrpl',
      chain_id: undefined,
      network: 'testnet',
    });
    expect(result).toHaveProperty('address');
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
