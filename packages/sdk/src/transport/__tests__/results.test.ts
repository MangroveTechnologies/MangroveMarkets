import { describe, it, expect, vi } from 'vitest';
import { RestTransport } from '../rest';
import { dataFromResponse, parseResult, ToolCallError } from '../results';

const envelope = {
  content: [{ type: 'text', text: '{"quote_id":"q"}' },
    { type: 'image', mimeType: 'image/png', data: 'aGVsbG8=' }],
  structuredContent: { quote_id: 'q' },
  _meta: { 'x402/payment-response': { transaction: 'fixture' } },
};

describe('full tool results', () => {
  it('retains content and receipt metadata', () => {
    expect(parseResult(envelope)).toEqual(envelope);
    expect(dataFromResponse({ result: parseResult(envelope) })).toEqual({ quote_id: 'q' });
  });

  it('preserves legacy JSON strings wrapped by FastMCP', () => {
    const result = parseResult({ ...envelope, structuredContent: { result: '{"quote_id":"q"}' } });
    expect(dataFromResponse({ result })).toEqual({ quote_id: 'q' });
  });

  it.each([
    { ...envelope, isError: true },
    { ...envelope, content: [{ type: 'text', text: '{"error":true,"code":"REJECTED","message":"Unavailable"}' }] },
    { ...envelope, structuredContent: { error: true, code: 'REJECTED' } },
  ])('never normalizes an error into success', input => {
    expect(() => dataFromResponse({ result: parseResult(input) })).toThrow(ToolCallError);
  });

  it('supports structured-only results', () => {
    expect(dataFromResponse({ result: parseResult({ content: [], structuredContent: { quote_id: 'q' } }) }))
      .toEqual({ quote_id: 'q' });
  });

  it('retains non-JSON text in full results but rejects it as business data', () => {
    const result = parseResult({ content: [{ type: 'text', text: 'explanation' }] });
    expect(result.content).toHaveLength(1);
    expect(() => dataFromResponse({ result })).toThrow('Expected JSON object');
  });

  it('does not echo malformed payloads in validation errors', () => {
    expect(() => parseResult({ content: 'fixture-private-value' })).toThrow('Malformed MCP tool response');
  });

  it('requests the opt-in representation and preserves HTTP receipt headers', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope), {
      headers: { 'X-Mangrove-Result-Format': 'mcp-v1', 'Payment-Response': 'fixture-receipt' },
    }));
    vi.stubGlobal('fetch', fetch);
    const result = await new RestTransport('https://fixture.invalid').callToolResult('quote', {});
    expect(result.result).toEqual(envelope);
    expect(result.headers?.['payment-response']).toBe('fixture-receipt');
    expect(fetch.mock.calls[0][1].headers['X-Mangrove-Result-Format']).toBe('mcp-v1');
    vi.unstubAllGlobals();
  });

  it('never replays a call to an older server', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"quote_id":"q"}'));
    vi.stubGlobal('fetch', fetch);
    await expect(new RestTransport('https://fixture.invalid').callToolResult('quote', {}))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_RESULT_FORMAT' });
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it.each(['missing_ack', 'invalid_envelope', 'invalid_json'])(
    'preserves HTTP receipts on %s without replay or message leakage', async failure => {
      const body = { content: 'fixture-private-payload' };
      const headers: Record<string, string> = { 'Payment-Response': 'fixture-receipt' };
      if (failure !== 'missing_ack') headers['X-Mangrove-Result-Format'] = 'mcp-v1';
      const fetch = vi.fn().mockResolvedValue(new Response(
        failure === 'invalid_json' ? 'fixture-private-payload' : JSON.stringify(body), { headers },
      ));
      vi.stubGlobal('fetch', fetch);
      try {
        const error = await new RestTransport('https://fixture.invalid')
          .callToolResult('quote', {}).then(() => { throw new Error('Expected rejection'); }, error => error);
        expect(error).toBeInstanceOf(ToolCallError);
        expect(error.code).toBe(failure === 'missing_ack' ? 'UNSUPPORTED_RESULT_FORMAT' : 'MALFORMED_RESPONSE');
        expect(error.response.status).toBe(200);
        expect(error.response.headers['payment-response']).toBe('fixture-receipt');
        expect(error.message).not.toContain('fixture-private-payload');
        expect(error.message).not.toContain('fixture-receipt');
        if (failure === 'invalid_envelope') {
          expect(error.responseBody).toEqual(body);
          expect(error.response.result).toEqual({ content: [], isError: true });
        }
        expect(fetch).toHaveBeenCalledTimes(1);
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );

  it('retains error codes, suggestions and payment headers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: true, code: 'PAYMENT_REQUIRED', message: 'Payment required', suggestion: 'Choose payment mode',
    }), { status: 402, headers: { 'Payment-Required': 'fixture-challenge' } })));
    await expect(new RestTransport('https://fixture.invalid').callToolResult('quote', {}))
      .rejects.toMatchObject({ code: 'PAYMENT_REQUIRED', suggestion: 'Choose payment mode',
        response: { status: 402, headers: { 'payment-required': 'fixture-challenge' } } });
    vi.unstubAllGlobals();
  });

  it('isolates concurrent response metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const name = url.split('/').pop();
      return new Response(JSON.stringify({ content: [], structuredContent: { name }, _meta: { name } }), {
        headers: { 'X-Mangrove-Result-Format': 'mcp-v1' },
      });
    }));
    const transport = new RestTransport('https://fixture.invalid');
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => transport.callToolResult(`quote_${i}`, {})));
    results.forEach((response, i) => expect(response.result._meta?.name).toBe(`quote_${i}`));
    vi.unstubAllGlobals();
  });

  it('rejects deceptive localhost domains', () => {
    expect(() => new RestTransport('http://localhost.example.com')).toThrow('requires HTTPS');
  });
});

it('bounds REST requests with a timeout without replay', async () => {
  const fetch = vi.fn(async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }));
  vi.stubGlobal('fetch', fetch);
  const timer = setTimeout(() => {}, 100);
  try {
    await expect(new RestTransport('https://fixture.invalid', undefined, 5).callToolResult('quote', {}))
      .rejects.toMatchObject({ name: 'TimeoutError' });
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    clearTimeout(timer);
    vi.unstubAllGlobals();
  }
});
