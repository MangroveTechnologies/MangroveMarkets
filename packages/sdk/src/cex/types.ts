/**
 * Domain types for the client-side CEX (Kraken) module.
 *
 * Ported from the server's `src/cex/models.py`. Money/volume/price fields are
 * strings to preserve exchange-provided precision.
 */

export type OrderType =
  | 'market'
  | 'limit'
  | 'stop-loss'
  | 'stop-loss-limit'
  | 'take-profit'
  | 'take-profit-limit'
  | 'trailing-stop'
  | 'trailing-stop-limit';

export type OrderSide = 'buy' | 'sell';

export type TimeInForce = 'GTC' | 'IOC' | 'GTD';

export type OrderStatus = 'pending' | 'open' | 'closed' | 'canceled' | 'expired';

/** Kraken verification tier — shapes the client-side rate limiter. */
export type KrakenTier = 'starter' | 'intermediate' | 'pro';

/** Constructor config for {@link KrakenClient}. BYOK: the key is the user's own. */
export interface KrakenClientConfig {
  /** Your Kraken API key. Required. */
  apiKey: string;
  /** Your Kraken API private key (base64). Required. */
  apiSecret: string;
  /** Kraken REST base URL. Defaults to `https://api.kraken.com`. */
  baseUrl?: string;
  /** Verification tier for rate-limit shaping. Default `intermediate`. */
  tier?: KrakenTier;
  /** Per-request timeout in milliseconds. Default 15000. */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Asset / Pair
// ---------------------------------------------------------------------------

export interface AssetInfo {
  venueId: string;
  venueSymbol: string;
  altname: string;
  displayName: string;
  decimals: number;
  displayDecimals: number;
}

export interface PairInfo {
  venueId: string;
  venuePair: string;
  altname: string;
  wsName?: string;
  base: string;
  quote: string;
  priceDecimals: number;
  volumeDecimals: number;
  orderMin: string;
  costMin: string;
  tickSize: string;
  status: string;
  takerFeePercent: number;
  makerFeePercent: number;
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export interface AssetBalance {
  asset: string;
  balance: string;
  holdTrade: string;
  available: string;
}

export interface AccountBalance {
  venueId: string;
  balances: AssetBalance[];
  fetchedAt: string;
}

export interface TradeBalance {
  venueId: string;
  referenceAsset: string;
  equivalentBalance: string;
  tradeBalance: string;
  marginAmount: string;
  unrealizedPnl: string;
  costBasis: string;
  floatingValuation: string;
  equity: string;
  freeMargin: string;
  marginLevel?: string;
}

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export interface CloseOrder {
  ordertype: OrderType;
  price: string;
  price2?: string;
}

export interface OrderRequest {
  pair: string;
  side: OrderSide;
  ordertype: OrderType;
  volume: string;
  price?: string;
  price2?: string;
  timeInForce?: TimeInForce;
  postOnly?: boolean;
  reduceOnly?: boolean;
  userref?: number;
  clOrdId?: string;
  expireTime?: string;
  close?: CloseOrder;
  validateOnly?: boolean;
}

export interface OrderReceipt {
  venueId: string;
  txid: string[];
  descr: string;
  pair: string;
  side: OrderSide;
  ordertype: OrderType;
  volume: string;
  price?: string;
  status: OrderStatus;
  submittedAt: string;
}

export interface OrderDetail {
  venueId: string;
  txid: string;
  userref?: number;
  clOrdId?: string;
  status: OrderStatus;
  opentm: string;
  closetm?: string;
  expiretm?: string;
  descrPair: string;
  descrType: string;
  descrOrdertype: string;
  descrPrice?: string;
  descrPrice2?: string;
  volume: string;
  volumeExecuted: string;
  cost: string;
  fee: string;
  avgPrice?: string;
  stopPrice?: string;
  limitPrice?: string;
  trades: string[];
  reason?: string;
}

// ---------------------------------------------------------------------------
// Trade
// ---------------------------------------------------------------------------

export interface TradeDetail {
  venueId: string;
  tradeId: string;
  orderTxid: string;
  pair: string;
  time: string;
  side: OrderSide;
  ordertype: OrderType;
  price: string;
  cost: string;
  fee: string;
  volume: string;
}

export interface PairFeeInfo {
  pair: string;
  takerFeePercent: number;
  makerFeePercent: number;
  volumeTier: string;
  nextTierVolume?: string;
}

export interface TradeVolumeInfo {
  venueId: string;
  currency: string;
  volume30d: string;
  fees: Record<string, PairFeeInfo>;
}

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export interface Ticker {
  venueId: string;
  pair: string;
  ask: string;
  bid: string;
  lastTradePrice: string;
  lastTradeVolume: string;
  volume24h: string;
  vwap24h: string;
  tradeCount24h: number;
  low24h: string;
  high24h: string;
  open24h: string;
}

export interface OhlcCandle {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  vwap: string;
  volume: string;
  count: number;
}

export interface OhlcSeries {
  venueId: string;
  pair: string;
  intervalMinutes: number;
  candles: OhlcCandle[];
  last: number;
}

export interface OrderBookLevel {
  price: string;
  volume: string;
  timestamp: number;
}

export interface OrderBook {
  venueId: string;
  pair: string;
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
}

export interface PublicTrade {
  price: string;
  volume: string;
  time: number;
  side: OrderSide;
  ordertype: string;
  tradeId: number;
}

export interface RecentTrades {
  venueId: string;
  pair: string;
  trades: PublicTrade[];
  last: string;
}

export interface VenueStatus {
  venueId: string;
  status: string;
  checkedAt: string;
}

/** Cancel-order / cancel-all result. */
export interface CancelResult {
  count: number;
  pending?: boolean;
}
