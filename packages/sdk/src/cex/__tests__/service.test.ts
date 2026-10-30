import { afterEach, describe, expect, it, vi } from 'vitest';
import { MangroveClient } from '../../client';
import { CexProxyError } from '../errors';

afterEach(() => vi.unstubAllGlobals());

describe('CexService Kraken OAuth lifecycle', () => {
  it('uses the authenticated REST proxy for consent, reads, validation, open orders, and cancel', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (url.endsWith('/connect')) {
        expect(body).toEqual({ mode: 'view' });
        return new Response(JSON.stringify({ authorize_url: 'https://id.kraken.test/consent', state: 'fixture-state' }));
      }
      if (url.endsWith('/status')) return new Response(JSON.stringify({ connected: true, connection: { mode: 'execute' } }));
      if (url.endsWith('/balances')) return new Response(JSON.stringify({ balances: [{ asset: 'XRP', amount: '5' }] }));
      if (url.endsWith('/orders') && init?.method === 'POST') {
        expect(body).toEqual({
          base: 'XRP', quote: 'USDC', side: 'buy', order_type: 'market', volume: '5', validate_only: true,
        });
        return new Response(JSON.stringify({ validate_only: true, tx_ids: [] }));
      }
      if (url.endsWith('/orders') && init?.method === 'GET') return new Response(JSON.stringify({ orders: [] }));
      if (url.endsWith('/orders/OABC-1') && init?.method === 'DELETE') return new Response(JSON.stringify({ count: 1 }));
      throw new Error(`Unexpected fixture request: ${init?.method} ${url}`);
    });
    vi.stubGlobal('fetch', fetch);

    const client = new MangroveClient({ url: 'https://markets.test/mcp', transport: 'rest', apiKey: 'market-key' });
    expect(await client.cex.connectStart()).toMatchObject({ state: 'fixture-state' });
    expect(await client.cex.status()).toMatchObject({ connected: true });
    expect(await client.cex.balances()).toMatchObject({ balances: [{ asset: 'XRP' }] });
    expect(await client.cex.placeOrder({ base: 'XRP', quote: 'USDC', side: 'buy', volume: '5', validateOnly: true }))
      .toMatchObject({ validate_only: true });
    expect(await client.cex.openOrders()).toEqual({ orders: [] });
    expect(await client.cex.cancelOrder('OABC-1')).toEqual({ count: 1 });

    expect(fetch).toHaveBeenCalledTimes(6);
    for (const [input, init] of fetch.mock.calls) {
      expect(String(input)).toMatch(/^https:\/\/markets\.test\/api\/v1\/exchanges\/kraken\//);
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer market-key');
      expect((init?.headers as Record<string, string>).Authorization).not.toContain('Kraken');
      if (init?.body) expect(String(init.body)).not.toContain('user_id');
    }
    expect(fetch.mock.calls[5][1]?.method).toBe('DELETE');
  });

  it('preserves proxy response evidence and never replays ambiguous requests', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: 'connection is view-only; reconnect in execute mode',
      code: 'EXECUTE_SCOPE_REQUIRED',
    }), {
      status: 403,
      headers: { 'X-Request-Id': 'fixture-request', 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);
    const client = new MangroveClient({ url: 'https://markets.test', apiKey: 'market-key' });

    const error = await client.cex.placeOrder({ base: 'XRP', quote: 'USDC', side: 'buy', volume: '5' })
      .then(() => { throw new Error('Expected rejection'); }, value => value);
    expect(error).toBeInstanceOf(CexProxyError);
    expect(error).toMatchObject({
      statusCode: 403,
      code: 'EXECUTE_SCOPE_REQUIRED',
      responseHeaders: { 'x-request-id': 'fixture-request' },
      responseBody: { detail: 'connection is view-only; reconnect in execute mode' },
    });
    expect(error.message).toContain('view-only');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects empty cancellation IDs and unsafe server URLs before making requests', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const client = new MangroveClient({ url: 'https://markets.test', apiKey: 'market-key' });
    await expect(client.cex.connectStart('invalid' as 'view')).rejects.toThrow("mode must be 'view' or 'execute'");
    await expect(client.cex.cancelOrder('')).rejects.toThrow('txId is required');
    expect(() => new MangroveClient({ url: 'http://markets.test' })).toThrow('requires HTTPS');
    expect(() => new MangroveClient({ url: 'https://user:secret@markets.test' })).toThrow('must not include credentials');
    expect(fetch).not.toHaveBeenCalled();
  });
});
