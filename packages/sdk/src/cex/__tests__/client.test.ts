import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { KrakenClient } from '../client';
import {
  CexError,
  CredentialsRequiredError,
  InvalidCredentialsError,
  InvalidNonceError,
  OrderMinNotMetError,
  PairNotFoundError,
  PermissionDeniedError,
  RateLimitedError,
  UnknownCexError,
  mapError,
  translateErrors,
} from '../errors';

const SECRET = Buffer.from('kraken-byok-test-secret-bytes-32x').toString('base64');
const KEY = 'TEST_API_KEY_1234567890';

function oracleSign(secret: string, uriPath: string, nonce: string, postData: string): string {
  const sha256 = createHash('sha256').update(nonce + postData).digest();
  const message = Buffer.concat([Buffer.from(uriPath), sha256]);
  return createHmac('sha512', Buffer.from(secret, 'base64')).update(message).digest('base64');
}

interface MockCall {
  url: string;
  init: RequestInit;
}

/** Install a fetch mock that returns queued JSON envelopes in FIFO order. */
function mockFetch(queue: unknown[]): { calls: MockCall[] } {
  const calls: MockCall[] = [];
  const responses = [...queue];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      const body = responses.length > 1 ? responses.shift() : responses[0];
      return {
        ok: true,
        status: 200,
        json: async () => body,
      } as Response;
    }),
  );
  return { calls };
}

function makeClient(): KrakenClient {
  return new KrakenClient({ apiKey: KEY, apiSecret: SECRET });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('credential gate', () => {
  it('throws CredentialsRequiredError without a key', () => {
    expect(() => new KrakenClient({ apiKey: '', apiSecret: SECRET })).toThrow(CredentialsRequiredError);
  });

  it('throws without a secret', () => {
    expect(() => new KrakenClient({ apiKey: KEY, apiSecret: '' })).toThrow(CredentialsRequiredError);
  });

  it('throws on whitespace-only credentials', () => {
    expect(() => new KrakenClient({ apiKey: '   ', apiSecret: SECRET })).toThrow(CredentialsRequiredError);
  });

  it('exposes a structured envelope', () => {
    try {
      new KrakenClient({ apiKey: '', apiSecret: '' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CredentialsRequiredError);
      const env = (e as CredentialsRequiredError).toEnvelope();
      expect(env.error).toBe(true);
      expect(env.code).toBe('CEX_CREDENTIALS_REQUIRED');
      expect(env.suggestion).toBeTruthy();
    }
  });
});

describe('error mapping', () => {
  const cases: Array<[string, string]> = [
    ['EAPI:Invalid key', 'CEX_INVALID_CREDENTIALS'],
    ['EAPI:Invalid signature', 'CEX_INVALID_CREDENTIALS'],
    ['EGeneral:Permission denied', 'CEX_PERMISSION_DENIED'],
    ['EAPI:Invalid nonce', 'CEX_INVALID_NONCE'],
    ['EAPI:Rate limit exceeded', 'CEX_RATE_LIMITED'],
    ['EOrder:Order minimum not met', 'CEX_ORDER_MIN_NOT_MET'],
    ['EQuery:Unknown asset pair', 'CEX_PAIR_NOT_FOUND'],
    ['ESomething:Totally unknown', 'CEX_UNKNOWN'],
  ];
  it.each(cases)('maps %s -> %s', (krakenErr, code) => {
    expect(mapError(krakenErr).code).toBe(code);
  });

  it('mapError returns the right subclasses', () => {
    expect(mapError('EAPI:Invalid key')).toBeInstanceOf(InvalidCredentialsError);
    expect(mapError('EGeneral:Permission denied')).toBeInstanceOf(PermissionDeniedError);
    expect(mapError('EAPI:Invalid nonce')).toBeInstanceOf(InvalidNonceError);
    expect(mapError('EAPI:Rate limit exceeded')).toBeInstanceOf(RateLimitedError);
    expect(mapError('EOrder:Order minimum not met')).toBeInstanceOf(OrderMinNotMetError);
    expect(mapError('EQuery:Unknown asset pair')).toBeInstanceOf(PairNotFoundError);
    expect(mapError('???')).toBeInstanceOf(UnknownCexError);
  });

  it('translateErrors picks the first mappable (non-unknown) error', () => {
    // First entry is unknown -> skipped; first mappable wins.
    const mapped = translateErrors(['EWeird:nope', 'EGeneral:Permission denied']);
    expect(mapped.code).toBe('CEX_PERMISSION_DENIED');
    // First entry already mappable -> used directly.
    const first = translateErrors(['EService:Busy', 'EGeneral:Permission denied']);
    expect(first.code).toBe('CEX_VENUE_UNAVAILABLE');
  });

  it('CexError is an Error subclass and instanceof works', () => {
    const e = mapError('EAPI:Invalid key');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(CexError);
  });
});

describe('public methods', () => {
  it('getTicker maps a snake-cased Kraken response', async () => {
    mockFetch([
      {
        error: [],
        result: {
          XXBTZUSD: {
            a: ['50000.0', '1', '1.0'],
            b: ['49999.0', '1', '1.0'],
            c: ['50000.5', '0.01'],
            v: ['10', '100'],
            p: ['49000', '49500'],
            t: [50, 500],
            l: ['48000', '47000'],
            h: ['51000', '52000'],
            o: '49000',
          },
        },
      },
    ]);
    const kraken = makeClient();
    const t = await kraken.getTicker('XBTUSD');
    expect(t.ask).toBe('50000.0');
    expect(t.bid).toBe('49999.0');
    expect(t.lastTradePrice).toBe('50000.5');
    expect(t.tradeCount24h).toBe(500);
  });

  it('getAssetPairs maps fee schedules', async () => {
    const { calls } = mockFetch([
      {
        error: [],
        result: {
          XXBTZUSD: {
            altname: 'XBTUSD',
            wsname: 'XBT/USD',
            base: 'XXBT',
            quote: 'ZUSD',
            pair_decimals: 1,
            lot_decimals: 8,
            ordermin: '0.0001',
            costmin: '0.5',
            status: 'online',
            fees: [[0, 0.26]],
            fees_maker: [[0, 0.16]],
          },
        },
      },
    ]);
    const kraken = makeClient();
    const pairs = await kraken.getAssetPairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].altname).toBe('XBTUSD');
    expect(pairs[0].takerFeePercent).toBe(0.26);
    expect(pairs[0].makerFeePercent).toBe(0.16);
    // Public endpoints are GET.
    expect(calls[0].init.method).toBe('GET');
  });
});

describe('private signing on the wire', () => {
  it('sends API-Key and a valid API-Sign for the actual body', async () => {
    const { calls } = mockFetch([{ error: [], result: { ZUSD: { balance: '100.0', hold_trade: '0' } } }]);
    const kraken = makeClient();
    await kraken.getBalance();
    const init = calls[0].init;
    const headers = init.headers as Record<string, string>;
    expect(headers['API-Key']).toBe(KEY);
    expect(headers['API-Sign']).toBeTruthy();
    const body = String(init.body);
    const nonce = new URLSearchParams(body).get('nonce')!;
    expect(headers['API-Sign']).toBe(oracleSign(SECRET, '/0/private/BalanceEx', nonce, body));
  });
});

describe('order management', () => {
  it('addOrder builds the flat Kraken body and maps the receipt', async () => {
    const { calls } = mockFetch([
      { error: [], result: { txid: ['OABC-123'], descr: { order: 'buy 0.01 XBTUSD @ market' } } },
    ]);
    const kraken = makeClient();
    const receipt = await kraken.addOrder({
      pair: 'XBTUSD',
      side: 'buy',
      ordertype: 'market',
      volume: '0.01',
    });
    expect(receipt.txid).toEqual(['OABC-123']);
    const body = String(calls[0].init.body);
    expect(body).toContain('pair=XBTUSD');
    expect(body).toContain('type=buy');
    expect(body).toContain('ordertype=market');
    expect(body).toContain('volume=0.01');
  });

  it('validateOrder sets validate=true', async () => {
    const { calls } = mockFetch([{ error: [], result: { descr: { order: 'validate' }, txid: [] } }]);
    const kraken = makeClient();
    await kraken.validateOrder({
      pair: 'XBTUSD',
      side: 'sell',
      ordertype: 'limit',
      volume: '0.01',
      price: '60000',
      validateOnly: true,
    });
    expect(String(calls[0].init.body)).toContain('validate=true');
  });

  it('cancelOrder maps the count', async () => {
    mockFetch([{ error: [], result: { count: 1 } }]);
    const kraken = makeClient();
    const out = await kraken.cancelOrder('OABC-123');
    expect(out).toEqual({ count: 1, pending: false });
  });
});

describe('error translation on calls', () => {
  it('translates a permission error from a private call', async () => {
    mockFetch([{ error: ['EGeneral:Permission denied'], result: {} }]);
    const kraken = makeClient();
    await expect(kraken.getBalance()).rejects.toMatchObject({ code: 'CEX_PERMISSION_DENIED' });
  });

  it('translates an unknown-pair error from a public call', async () => {
    mockFetch([{ error: ['EQuery:Unknown asset pair'], result: {} }]);
    const kraken = makeClient();
    await expect(kraken.getTicker('NOPE')).rejects.toMatchObject({ code: 'CEX_PAIR_NOT_FOUND' });
  });
});

describe('retry behavior', () => {
  it('retries once on invalid nonce then succeeds', async () => {
    const { calls } = mockFetch([
      { error: ['EAPI:Invalid nonce'], result: {} },
      { error: [], result: { ZUSD: { balance: '5.0', hold_trade: '0' } } },
    ]);
    const kraken = makeClient();
    const bal = await kraken.getBalance();
    expect(calls).toHaveLength(2);
    expect(bal.balances.some((b) => b.asset === 'ZUSD')).toBe(true);
  });

  it('raises invalid nonce when it persists', async () => {
    mockFetch([{ error: ['EAPI:Invalid nonce'], result: {} }]);
    const kraken = makeClient();
    await expect(kraken.getBalance()).rejects.toBeInstanceOf(InvalidNonceError);
  });
});
