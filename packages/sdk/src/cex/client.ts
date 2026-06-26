/**
 * Client-side Kraken client (BYOK) for the MangroveMarkets TypeScript SDK.
 *
 * Ported from the MangroveMarkets-MCP-Server `src/cex/kraken/client.py` +
 * adapter. The user supplies their **own** Kraken API key/secret; the SDK signs
 * locally (HMAC-SHA512) and calls `api.kraken.com` directly. The key never
 * reaches any Mangrove service. Construction without credentials throws
 * `CredentialsRequiredError` — every CEX method is gated on the key.
 *
 * Targeting note: this module uses Node's `crypto` for signing and the global
 * `fetch` (Node 18+). Kraken's private endpoints cannot be called from a
 * browser (CORS, and you must never ship a Kraken secret to a browser), so a
 * Web Crypto fallback is intentionally omitted. The rest of the SDK is
 * likewise Node-oriented (native `fetch` in RestTransport, `@types/node`).
 *
 * Deviation from the server adapter: the server resolved every pair/asset alias
 * to its Kraken canonical symbol via a cached `AssetPairs` lookup before each
 * call. This SDK passes the caller-supplied pair/asset straight through to
 * Kraken (the REST API accepts altnames like `XBTUSD` as well as canonical
 * `XXBTZUSD`), avoiding an extra metadata round-trip. Use `getAssetPairs()` /
 * `getAssets()` for canonical metadata.
 */
import { CredentialsRequiredError, translateErrors } from './errors';
import {
  NonceGenerator,
  RateCounter,
  TIER_LIMITS,
  restCost,
  signRequest,
} from './signing';
import {
  toAccountBalance,
  toAssetInfo,
  toOhlcSeries,
  toOrderBook,
  toOrderDetail,
  toOrderReceipt,
  toPairInfo,
  toRecentTrades,
  toTicker,
  toTradeBalance,
  toTradeDetail,
  toTradeVolumeInfo,
  toVenueStatus,
} from './mapping';
import type {
  AccountBalance,
  AssetInfo,
  CancelResult,
  KrakenClientConfig,
  KrakenTier,
  OhlcSeries,
  OrderBook,
  OrderDetail,
  OrderReceipt,
  OrderRequest,
  PairInfo,
  RecentTrades,
  Ticker,
  TradeBalance,
  TradeDetail,
  TradeVolumeInfo,
  VenueStatus,
} from './types';

type Raw = Record<string, unknown>;

/** Kraken envelope: `{ error: string[], result: ... }`. */
interface KrakenResponse {
  error?: string[];
  result?: unknown;
}

const DEFAULT_BASE_URL = 'https://api.kraken.com';
const DEFAULT_TIMEOUT_MS = 15_000;

/** Build the flat Kraken AddOrder body from an OrderRequest. Ported from the server adapter. */
function buildAddOrderParams(req: OrderRequest, forceValidate = false): Record<string, unknown> {
  const params: Record<string, unknown> = {
    pair: req.pair,
    type: req.side,
    ordertype: req.ordertype,
    volume: req.volume,
  };
  if (req.price !== undefined) params.price = req.price;
  if (req.price2 !== undefined) params.price2 = req.price2;
  // GTC is Kraken's implicit default; only send IOC / GTD.
  if (req.timeInForce && req.timeInForce !== 'GTC') params.timeinforce = req.timeInForce;
  const oflags: string[] = [];
  if (req.postOnly) oflags.push('post');
  if (oflags.length) params.oflags = oflags.join(',');
  if (req.reduceOnly) params.reduce_only = true;
  if (req.userref !== undefined) params.userref = req.userref;
  if (req.clOrdId !== undefined) params.cl_ord_id = req.clOrdId;
  if (req.expireTime) params.expiretm = req.expireTime;
  if (req.close) {
    params['close[ordertype]'] = req.close.ordertype;
    params['close[price]'] = req.close.price;
    if (req.close.price2 !== undefined) params['close[price2]'] = req.close.price2;
  }
  if (forceValidate || req.validateOnly) params.validate = true;
  return params;
}

/** Kraken form-encodes lists as comma-separated strings. */
function joined(value: unknown): unknown {
  return Array.isArray(value) ? value.map(String).join(',') : value;
}

/**
 * Client-side, typed Kraken client. Bring your own key.
 *
 * @example
 * ```ts
 * const kraken = new KrakenClient({ apiKey: '...', apiSecret: '...' });
 * const balance = await kraken.getBalance();
 * const ticker = await kraken.getTicker('XBTUSD');
 * ```
 */
export class KrakenClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly tier: KrakenTier;
  private readonly timeoutMs: number;

  private readonly nonceGen = new NonceGenerator();
  private readonly restCounter: RateCounter;
  private readonly tradingCounter: RateCounter;
  /** AddOrder txid -> placement epoch ms, for fast-cancel (+8) accounting. */
  private readonly recentOrders = new Map<string, number>();

  constructor(config: KrakenClientConfig) {
    const { apiKey, apiSecret } = config;
    if (!apiKey || !apiKey.trim() || !apiSecret || !apiSecret.trim()) {
      throw new CredentialsRequiredError();
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.tier = config.tier ?? 'intermediate';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const limits = TIER_LIMITS[this.tier] ?? TIER_LIMITS.intermediate;
    this.restCounter = new RateCounter(limits.restMax, limits.restDecay);
    this.tradingCounter = new RateCounter(limits.tradingMax, limits.tradingDecay);
  }

  // ------------------------------------------------------------------
  // Rate-limit gate
  // ------------------------------------------------------------------

  private async gate(counter: RateCounter, cost: number): Promise<void> {
    const softCap = counter.cap * 0.8;
    if (counter.current() + cost > softCap) {
      const wait = counter.secondsUntil(softCap - cost);
      if (wait > 0) await sleep(wait * 1000);
    }
    counter.add(cost);
  }

  private cancelCost(txid?: string): number {
    if (!txid) return 1.0;
    const placedAt = this.recentOrders.get(txid);
    if (placedAt === undefined) return 1.0;
    return Date.now() - placedAt < 10_000 ? 8.0 : 1.0;
  }

  // ------------------------------------------------------------------
  // HTTP plumbing
  // ------------------------------------------------------------------

  private async fetchJson(path: string, init: RequestInit): Promise<Raw> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
      if (!response.ok) {
        // Surface HTTP-level failures as a Kraken-style error list so the
        // translator can map common cases (e.g. 5xx -> venue unavailable).
        throw translateErrors([`EService:Unavailable (HTTP ${response.status})`]);
      }
      const payload = (await response.json()) as KrakenResponse;
      const errors = payload.error ?? [];
      if (errors.length > 0) {
        throw translateErrors(errors);
      }
      return (payload.result ?? {}) as Raw;
    } finally {
      clearTimeout(timer);
    }
  }

  private async publicGet(path: string, params?: Record<string, unknown>): Promise<Raw> {
    await this.gate(this.restCounter, restCost(path));
    const query = params ? `?${encodeParams(params)}` : '';
    return this.fetchJson(`${path}${query}`, { method: 'GET' });
  }

  private async doPrivatePost(path: string, body: Record<string, unknown>): Promise<Raw> {
    const nonce = this.nonceGen.next();
    const signedBody: Record<string, unknown> = { ...body, nonce };
    const postData = encodeParams(signedBody);
    const signature = signRequest(this.apiSecret, path, nonce, postData);
    return this.fetchJson(path, {
      method: 'POST',
      headers: {
        'API-Key': this.apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData,
    });
  }

  private async privatePost(path: string, body: Record<string, unknown> = {}): Promise<Raw> {
    // Pre-call gating: AddOrder/CancelOrder/CancelAll use the trading counter.
    if (path === '/0/private/AddOrder') {
      await this.gate(this.tradingCounter, 1.0);
    } else if (path === '/0/private/CancelOrder') {
      await this.gate(this.tradingCounter, this.cancelCost(body.txid as string | undefined));
    } else if (path === '/0/private/CancelAll') {
      await this.gate(this.tradingCounter, 1.0);
    } else {
      await this.gate(this.restCounter, restCost(path));
    }

    let result: Raw;
    try {
      result = await this.doPrivatePost(path, body);
    } catch (err) {
      // Invalid nonce: one retry with a fresh nonce.
      if (isCode(err, 'CEX_INVALID_NONCE')) {
        result = await this.doPrivatePost(path, body);
      } else if (isCode(err, 'CEX_RATE_LIMITED')) {
        // Rate-limit exceeded: backoff + one retry.
        await sleep(2000);
        result = await this.doPrivatePost(path, body);
      } else {
        throw err;
      }
    }

    // Record AddOrder txids for fast-cancel accounting.
    if (path === '/0/private/AddOrder') {
      const txids = Array.isArray(result.txid) ? result.txid : [];
      for (const txid of txids) this.recentOrders.set(String(txid), Date.now());
    }
    return result;
  }

  // ==================================================================
  // Public market data
  // ==================================================================

  /** Kraken server time (raw `{ unixtime, rfc1123 }`). */
  async getServerTime(): Promise<Raw> {
    return this.publicGet('/0/public/Time');
  }

  /** Kraken system status (online / cancel_only / maintenance). */
  async getSystemStatus(): Promise<VenueStatus> {
    return toVenueStatus(await this.publicGet('/0/public/SystemStatus'));
  }

  /** List asset metadata, optionally filtered to one asset. */
  async getAssets(asset?: string): Promise<AssetInfo[]> {
    const raw = await this.publicGet('/0/public/Assets', asset ? { asset } : undefined);
    return Object.entries(raw).map(([symbol, info]) => toAssetInfo(symbol, info as Raw));
  }

  /** List trading-pair metadata, optionally filtered to one pair. */
  async getAssetPairs(pair?: string): Promise<PairInfo[]> {
    const raw = await this.publicGet('/0/public/AssetPairs', pair ? { pair } : undefined);
    return Object.entries(raw).map(([p, info]) => toPairInfo(p, info as Raw));
  }

  /** Ticker snapshot for a pair. */
  async getTicker(pair: string): Promise<Ticker> {
    const raw = await this.publicGet('/0/public/Ticker', { pair });
    // Kraken keys the response by its canonical pair; use the first key.
    const keyed = Object.keys(raw)[0] ?? pair;
    return toTicker(keyed, raw);
  }

  /** OHLC candles for a pair. `interval` is in minutes. */
  async getOhlc(pair: string, interval = 1, since?: number): Promise<OhlcSeries> {
    const params: Record<string, unknown> = { pair, interval };
    if (since !== undefined) params.since = since;
    return toOhlcSeries(pair, interval, await this.publicGet('/0/public/OHLC', params));
  }

  /** Order book (depth) for a pair. */
  async getOrderBook(pair: string, count?: number): Promise<OrderBook> {
    const params: Record<string, unknown> = { pair };
    if (count !== undefined) params.count = count;
    return toOrderBook(pair, await this.publicGet('/0/public/Depth', params));
  }

  /** Alias for {@link getOrderBook} matching the Kraken endpoint name. */
  async getDepth(pair: string, count?: number): Promise<OrderBook> {
    return this.getOrderBook(pair, count);
  }

  /** Recent public trades for a pair. */
  async getRecentTrades(pair: string, since?: string): Promise<RecentTrades> {
    const params: Record<string, unknown> = { pair };
    if (since !== undefined) params.since = since;
    return toRecentTrades(pair, await this.publicGet('/0/public/Trades', params));
  }

  /** Recent bid/ask spread data for a pair (raw Kraken result). */
  async getSpread(pair: string, since?: string): Promise<Raw> {
    const params: Record<string, unknown> = { pair };
    if (since !== undefined) params.since = since;
    return this.publicGet('/0/public/Spread', params);
  }

  // ==================================================================
  // Private — account / balance
  // ==================================================================

  /** Account balances (uses BalanceEx for hold/available detail). */
  async getBalance(): Promise<AccountBalance> {
    return toAccountBalance(await this.privatePost('/0/private/BalanceEx'));
  }

  /** Margin/equity summary in the given reference asset (default ZUSD). */
  async getTradeBalance(asset?: string): Promise<TradeBalance> {
    const body: Record<string, unknown> = {};
    if (asset !== undefined) body.asset = asset;
    return toTradeBalance(await this.privatePost('/0/private/TradeBalance', body), asset ?? 'ZUSD');
  }

  /** 30-day trade volume and per-pair fee schedule. */
  async getTradeVolume(pairs?: string[]): Promise<TradeVolumeInfo> {
    const body: Record<string, unknown> = { 'fee-info': 'true' };
    if (pairs && pairs.length) body.pair = joined(pairs);
    return toTradeVolumeInfo(await this.privatePost('/0/private/TradeVolume', body));
  }

  // ==================================================================
  // Private — order queries
  // ==================================================================

  /** Currently open orders. */
  async getOpenOrders(userref?: number): Promise<OrderDetail[]> {
    const body: Record<string, unknown> = { trades: 'false' };
    if (userref !== undefined) body.userref = userref;
    const raw = await this.privatePost('/0/private/OpenOrders', body);
    const open = (raw.open as Raw) ?? {};
    return Object.entries(open).map(([txid, p]) => toOrderDetail(txid, p as Raw));
  }

  /** Closed orders (paginated via `offset`). */
  async getClosedOrders(start?: number, end?: number, offset = 0): Promise<OrderDetail[]> {
    const body: Record<string, unknown> = { trades: 'false', ofs: offset, closetime: 'both' };
    if (start !== undefined) body.start = start;
    if (end !== undefined) body.end = end;
    const raw = await this.privatePost('/0/private/ClosedOrders', body);
    const closed = (raw.closed as Raw) ?? {};
    return Object.entries(closed).map(([txid, p]) => toOrderDetail(txid, p as Raw));
  }

  /** Look up specific orders by txid. */
  async queryOrders(txids: string[]): Promise<OrderDetail[]> {
    const body: Record<string, unknown> = { txid: joined(txids), trades: 'false' };
    const raw = await this.privatePost('/0/private/QueryOrders', body);
    return Object.entries(raw).map(([txid, p]) => toOrderDetail(txid, p as Raw));
  }

  // ==================================================================
  // Private — trade history
  // ==================================================================

  /** Historical trades (paginated via `offset`). */
  async getTradesHistory(start?: number, end?: number, offset = 0): Promise<TradeDetail[]> {
    const body: Record<string, unknown> = { trades: 'false', ofs: offset };
    if (start !== undefined) body.start = start;
    if (end !== undefined) body.end = end;
    const raw = await this.privatePost('/0/private/TradesHistory', body);
    const trades = (raw.trades as Raw) ?? {};
    return Object.entries(trades).map(([id, p]) => toTradeDetail(id, p as Raw));
  }

  /** Look up specific trades by id. */
  async queryTrades(txids: string[]): Promise<TradeDetail[]> {
    const body: Record<string, unknown> = { txid: joined(txids), trades: 'false' };
    const raw = await this.privatePost('/0/private/QueryTrades', body);
    return Object.entries(raw).map(([id, p]) => toTradeDetail(id, p as Raw));
  }

  // ==================================================================
  // Private — order management
  // ==================================================================

  /** Place an order. Set `req.validateOnly = true` for a dry run. */
  async addOrder(req: OrderRequest): Promise<OrderReceipt> {
    const params = buildAddOrderParams(req);
    const raw = await this.privatePost('/0/private/AddOrder', params);
    return toOrderReceipt(raw, req.pair, req.side, req.ordertype, req.volume, req.price);
  }

  /** Dry-run an order against Kraken without placing it. */
  async validateOrder(req: OrderRequest): Promise<OrderReceipt> {
    const params = buildAddOrderParams(req, true);
    const raw = await this.privatePost('/0/private/AddOrder', params);
    return toOrderReceipt(raw, req.pair, req.side, req.ordertype, req.volume, req.price);
  }

  /** Edit an existing order. Mirrors AddOrder minus validate/close/bracket. */
  async editOrder(txid: string, req: OrderRequest): Promise<OrderReceipt> {
    const params: Record<string, unknown> = { txid, pair: req.pair, volume: req.volume };
    if (req.price !== undefined) params.price = req.price;
    if (req.price2 !== undefined) params.price2 = req.price2;
    if (req.userref !== undefined) params.userref = req.userref;
    if (req.clOrdId !== undefined) params.cl_ord_id = req.clOrdId;
    const oflags: string[] = [];
    if (req.postOnly) oflags.push('post');
    if (oflags.length) params.oflags = oflags.join(',');
    const raw = await this.privatePost('/0/private/EditOrder', params);
    return toOrderReceipt(raw, req.pair, req.side, req.ordertype, req.volume, req.price);
  }

  /** Cancel a single order by txid. */
  async cancelOrder(txid: string): Promise<CancelResult> {
    const raw = await this.privatePost('/0/private/CancelOrder', { txid });
    return { count: Number(raw.count ?? 0) || 0, pending: Boolean(raw.pending) };
  }

  /** Cancel all open orders. */
  async cancelAll(): Promise<CancelResult> {
    const raw = await this.privatePost('/0/private/CancelAll');
    return { count: Number(raw.count ?? 0) || 0 };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Application/x-www-form-urlencoded encoding identical to Python's urlencode. */
function encodeParams(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.join('&');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCode(err: unknown, code: string): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === code;
}
