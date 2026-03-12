import { describe, it, expect, vi } from 'vitest';
import { handlePortfolio } from '../skills/portfolio';
import type { Transport } from '@mangrovemarkets/sdk';

function mockTransport(): Transport {
  return {
    callTool: vi.fn().mockImplementation((name: string) => {
      if (name === 'oneinch_portfolio_value') return Promise.resolve({ total_usd: '5000' });
      if (name === 'oneinch_portfolio_pnl') return Promise.resolve({ pnl_usd: '200' });
      if (name === 'oneinch_balances') return Promise.resolve({ tokens: [{ symbol: 'USDC' }] });
      return Promise.resolve({});
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe('handlePortfolio', () => {
  it('gets portfolio value', async () => {
    const transport = mockTransport();
    const result = await handlePortfolio(transport, {
      action: 'value',
      addresses: ['0x1'],
      chain_id: 8453,
    });
    expect(transport.callTool).toHaveBeenCalledWith('oneinch_portfolio_value', {
      addresses: ['0x1'],
      chain_id: 8453,
    });
    expect(result).toHaveProperty('total_usd', '5000');
  });

  it('gets portfolio PnL', async () => {
    const transport = mockTransport();
    const result = await handlePortfolio(transport, {
      action: 'pnl',
      addresses: ['0x1'],
      chain_id: 8453,
    });
    expect(transport.callTool).toHaveBeenCalledWith('oneinch_portfolio_pnl', {
      addresses: ['0x1'],
      chain_id: 8453,
    });
    expect(result).toHaveProperty('pnl_usd', '200');
  });

  it('gets token balances', async () => {
    const transport = mockTransport();
    const result = await handlePortfolio(transport, {
      action: 'balances',
      wallet: '0x1',
      chain_id: 8453,
    });
    expect(transport.callTool).toHaveBeenCalledWith('oneinch_balances', {
      wallet: '0x1',
      chain_id: 8453,
    });
    expect(result).toHaveProperty('tokens');
  });
});
