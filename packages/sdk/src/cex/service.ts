import { CexProxyError } from './errors';
import type { CexResponse, KrakenConnectionMode, KrakenOrderParams } from './types';

const DEFAULT_TIMEOUT_MS = 30_000;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function apiBaseUrl(serverUrl: string): string {
  const url = new URL(serverUrl);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('CexService URL must not include credentials, query, or fragment');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) {
    throw new Error('CexService requires HTTPS for non-local URLs');
  }

  // Accept the same server roots as MangroveClient, including its documented
  // /mcp endpoint, and target the server's REST OAuth proxy directly.
  const basePath = url.pathname.replace(/\/+$/, '').replace(/\/mcp$/i, '').replace(/\/api\/v1$/i, '');
  return `${url.origin}${basePath}/api/v1`;
}

function responseHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    const detail = record.detail;
    if (typeof detail === 'string' && detail.length > 0) return detail;
    if (typeof record.message === 'string' && record.message.length > 0) return record.message;
  }
  return `Kraken OAuth proxy returned HTTP ${status}`;
}

/**
 * Keyless Kraken OAuth client. It sends the user's Mangrove API key to the
 * MangroveMarkets server; it never accepts or sends a Kraken venue credential.
 * Requests are direct REST calls and are never automatically retried because
 * connect and order outcomes can be ambiguous after a lost response.
 */
export class CexService {
  private readonly baseUrl: string;

  constructor(
    serverUrl: string,
    private readonly apiKey?: string,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.baseUrl = apiBaseUrl(serverUrl);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('timeoutMs must be a positive safe integer');
    }
  }

  /** Start OAuth consent. The caller must show/open the returned URL for the user. */
  async connectStart(mode: KrakenConnectionMode = 'view'): Promise<CexResponse> {
    if (mode !== 'view' && mode !== 'execute') throw new Error("mode must be 'view' or 'execute'");
    return this.request('POST', '/connect', { mode });
  }

  /** Read the connection and granted access mode. */
  async status(): Promise<CexResponse> {
    return this.request('GET', '/status');
  }

  /** Read balances from the connected Kraken account. */
  async balances(): Promise<CexResponse> {
    return this.request('GET', '/balances');
  }

  /** Place or validate an order. Validation does not place a live order. */
  async placeOrder(params: KrakenOrderParams): Promise<CexResponse> {
    return this.request('POST', '/orders', {
      base: params.base,
      quote: params.quote,
      side: params.side,
      order_type: params.orderType ?? 'market',
      volume: params.volume,
      ...(params.limitPrice !== undefined ? { limit_price: params.limitPrice } : {}),
      ...(params.clientRef !== undefined ? { client_ref: params.clientRef } : {}),
      validate_only: params.validateOnly ?? false,
    });
  }

  /** List open orders for the connected Kraken account. */
  async openOrders(): Promise<CexResponse> {
    return this.request('GET', '/orders');
  }

  /** Cancel an open order by Kraken transaction ID. */
  async cancelOrder(txId: string): Promise<CexResponse> {
    if (!txId) throw new Error('txId is required');
    return this.request('DELETE', `/orders/${encodeURIComponent(txId)}`);
  }

  private async request(method: string, path: string, body?: Record<string, unknown>): Promise<CexResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const response = await fetch(`${this.baseUrl}/exchanges/kraken${path}`, {
      method,
      redirect: 'error',
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const headersByName = responseHeaders(response.headers);
    const text = await response.text();
    let data: unknown = {};
    if (text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new CexProxyError(
          `Kraken OAuth proxy returned invalid JSON (HTTP ${response.status})`,
          response.status,
          headersByName,
          text,
          'MALFORMED_RESPONSE',
        );
      }
    }
    if (!response.ok) {
      const code = typeof data === 'object' && data !== null && !Array.isArray(data) &&
        typeof (data as Record<string, unknown>).code === 'string'
        ? (data as Record<string, unknown>).code as string
        : 'CEX_PROXY_ERROR';
      throw new CexProxyError(errorMessage(data, response.status), response.status, headersByName, data, code);
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new CexProxyError(
        `Kraken OAuth proxy returned an unexpected JSON value (HTTP ${response.status})`,
        response.status,
        headersByName,
        data,
        'MALFORMED_RESPONSE',
      );
    }
    return data as CexResponse;
  }
}
