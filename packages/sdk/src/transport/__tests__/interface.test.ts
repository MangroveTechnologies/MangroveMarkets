import { describe, it, expect } from 'vitest';
import { MockTransport } from './mock';

describe('MockTransport', () => {
  it('records tool calls and returns configured responses', async () => {
    const mock = new MockTransport();
    mock.addResponse('dex_get_quote', { quoteId: 'q-1', inputAmount: '1000' });

    const result = await mock.callTool('dex_get_quote', { src: '0xa', dst: '0xb', amount: '1000', chain_id: 1 });

    expect(result).toEqual({ quoteId: 'q-1', inputAmount: '1000' });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].name).toBe('dex_get_quote');
    expect(mock.calls[0].params.src).toBe('0xa');
  });

  it('connect and disconnect are no-ops', async () => {
    const mock = new MockTransport();
    await expect(mock.connect()).resolves.toBeUndefined();
    await expect(mock.disconnect()).resolves.toBeUndefined();
  });

  it('throws if no response configured for tool', async () => {
    const mock = new MockTransport();
    await expect(mock.callTool('unknown_tool', {})).rejects.toThrow('No mock response for tool: unknown_tool');
  });

  it('supports sequential responses', async () => {
    const mock = new MockTransport();
    mock.addResponse('dex_tx_status', { status: 'pending' });
    mock.addResponse('dex_tx_status', { status: 'confirmed' });

    const r1 = await mock.callTool('dex_tx_status', { tx_hash: '0x1', chain_id: 1 });
    const r2 = await mock.callTool('dex_tx_status', { tx_hash: '0x1', chain_id: 1 });
    expect(r1).toEqual({ status: 'pending' });
    expect(r2).toEqual({ status: 'confirmed' });
  });
});
