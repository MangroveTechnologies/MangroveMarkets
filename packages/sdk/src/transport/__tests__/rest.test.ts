import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestTransport } from '../rest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('RestTransport', () => {
  let transport: RestTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new RestTransport('https://api.mangrovemarkets.com', 'test-key');
  });

  it('callTool sends POST to /api/tools/{name}', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ quoteId: 'q-1' }),
    });

    const result = await transport.callTool('dex_get_quote', { src: '0xa', dst: '0xb' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.mangrovemarkets.com/api/v1/tools/dex_get_quote',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
        },
        body: JSON.stringify({ src: '0xa', dst: '0xb' }),
      },
    );
    expect(result).toEqual({ quoteId: 'q-1' });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: true, message: 'Server error' }),
    });

    await expect(transport.callTool('dex_get_quote', {})).rejects.toThrow('500');
  });

  it('connect and disconnect are no-ops', async () => {
    await expect(transport.connect()).resolves.toBeUndefined();
    await expect(transport.disconnect()).resolves.toBeUndefined();
  });

  it('omits Authorization header when no apiKey', async () => {
    const noAuth = new RestTransport('https://api.mangrovemarkets.com');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    await noAuth.callTool('dex_get_quote', {});

    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers).not.toHaveProperty('Authorization');
  });

  it('rejects non-HTTPS URLs', () => {
    expect(() => new RestTransport('http://api.example.com')).toThrow('requires HTTPS');
  });

  it('allows localhost HTTP', () => {
    expect(() => new RestTransport('http://localhost:8080')).not.toThrow();
  });

  it('rejects invalid tool names', async () => {
    await expect(transport.callTool('../etc/passwd', {})).rejects.toThrow('Invalid tool name');
    await expect(transport.callTool('tool?query=1', {})).rejects.toThrow('Invalid tool name');
  });

  it('detects error body in 200 OK response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ error: true, code: 'BROADCAST_ERROR', message: 'tx failed' }),
    });

    await expect(transport.callTool('dex_broadcast', {})).rejects.toThrow('tx failed');
  });
});
