/**
 * Convert raw Kraken JSON responses into typed domain objects.
 *
 * Ported from the server's `src/cex/kraken/mapping.py`. This is where Kraken's
 * arcana — X/Z prefixes, float unix times, nested arrays, "X.HOLD"
 * sub-balances — stops leaking into the rest of the SDK.
 */
import type {
  AccountBalance,
  AssetBalance,
  AssetInfo,
  OhlcCandle,
  OhlcSeries,
  OrderBook,
  OrderBookLevel,
  OrderDetail,
  OrderReceipt,
  OrderSide,
  OrderStatus,
  OrderType,
  PairFeeInfo,
  PairInfo,
  PublicTrade,
  RecentTrades,
  Ticker,
  TradeBalance,
  TradeDetail,
  TradeVolumeInfo,
  VenueStatus,
} from './types';

export const VENUE_ID = 'kraken';

type Raw = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function s(value: unknown, def = '0'): string {
  if (value === null || value === undefined) return def;
  return String(value);
}

function num(value: unknown, def = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : def;
}

function unixToIso(unixTs: unknown): string {
  const t = Number(unixTs);
  if (!Number.isFinite(t)) return '';
  return new Date(t * 1000).toISOString();
}

function optionalUnixIso(unixTs: unknown): string | undefined {
  if (unixTs === null || unixTs === undefined || unixTs === 0 || unixTs === '0' || unixTs === 0.0) {
    return undefined;
  }
  return unixToIso(unixTs);
}

function priceDecimals(raw: Raw): number {
  if (raw.pair_decimals !== undefined) return num(raw.pair_decimals, 8);
  if (raw.cost_decimals !== undefined) return num(raw.cost_decimals, 8);
  return 8;
}

function volumeDecimals(raw: Raw): number {
  if (raw.lot_decimals !== undefined) return num(raw.lot_decimals, 8);
  if (raw.lot_multiplier !== undefined) return num(raw.lot_multiplier, 8);
  return 8;
}

function tickSize(raw: Raw): string {
  if (raw.tick_size !== undefined) return s(raw.tick_size);
  const decimals = priceDecimals(raw);
  return decimals > 0 ? `1e-${decimals}` : '1';
}

/** Fee for the base (zero-volume) tier; Kraken returns [[threshold, pct], ...]. */
function feeForZeroVolume(raw: Raw, key = 'fees'): number {
  const schedule = raw[key];
  if (!Array.isArray(schedule) || schedule.length === 0) return 0;
  const first = schedule[0];
  if (Array.isArray(first) && first.length > 1) {
    return num(first[1], 0);
  }
  return 0;
}

function asRaw(value: unknown): Raw {
  return value && typeof value === 'object' ? (value as Raw) : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export function toAssetInfo(venueSymbol: string, raw: Raw): AssetInfo {
  return {
    venueId: VENUE_ID,
    venueSymbol,
    altname: s(raw.altname, venueSymbol),
    displayName: s(raw.display_name || raw.altname || venueSymbol, venueSymbol),
    decimals: num(raw.decimals, 8),
    displayDecimals: num(raw.display_decimals, 4),
  };
}

export function toPairInfo(venuePair: string, raw: Raw): PairInfo {
  const makerFeesKey = raw.fees_maker !== undefined ? 'fees_maker' : 'fees';
  return {
    venueId: VENUE_ID,
    venuePair,
    altname: s(raw.altname, venuePair),
    wsName: raw.wsname !== undefined && raw.wsname !== null ? s(raw.wsname) : undefined,
    base: s(raw.base, ''),
    quote: s(raw.quote, ''),
    priceDecimals: priceDecimals(raw),
    volumeDecimals: volumeDecimals(raw),
    orderMin: s(raw.ordermin, '0'),
    costMin: s(raw.costmin, '0'),
    tickSize: tickSize(raw),
    status: s(raw.status, 'online'),
    takerFeePercent: feeForZeroVolume(raw, 'fees'),
    makerFeePercent: feeForZeroVolume(raw, makerFeesKey),
  };
}

export function toVenueStatus(raw: Raw): VenueStatus {
  return {
    venueId: VENUE_ID,
    status: s(raw.status, 'unknown'),
    checkedAt: raw.timestamp ? s(raw.timestamp) : new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export function toAccountBalance(raw: Raw): AccountBalance {
  const entries: AssetBalance[] = [];
  for (const [asset, payload] of Object.entries(raw || {})) {
    if (payload && typeof payload === 'object') {
      const p = payload as Raw;
      const total = s(p.balance, '0');
      const hold = s(p.hold_trade, '0');
      const credit = s(p.credit, '0');
      let available: string;
      const availNum = Number(total) - Number(hold) + Number(credit);
      if (Number.isFinite(availNum)) {
        available = availNum.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
        if (available === '' || available === '-') available = '0';
      } else {
        available = total;
      }
      entries.push({ asset, balance: total, holdTrade: hold, available });
    } else {
      const total = s(payload, '0');
      entries.push({ asset, balance: total, holdTrade: '0', available: total });
    }
  }
  return { venueId: VENUE_ID, balances: entries, fetchedAt: new Date().toISOString() };
}

export function toTradeBalance(raw: Raw, refAsset: string): TradeBalance {
  return {
    venueId: VENUE_ID,
    referenceAsset: refAsset,
    equivalentBalance: s(raw.eb, '0'),
    tradeBalance: s(raw.tb, '0'),
    marginAmount: s(raw.m, '0'),
    unrealizedPnl: s(raw.n, '0'),
    costBasis: s(raw.c, '0'),
    floatingValuation: s(raw.v, '0'),
    equity: s(raw.e, '0'),
    freeMargin: s(raw.mf, '0'),
    marginLevel: raw.ml !== undefined && raw.ml !== null ? s(raw.ml) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Ticker / OHLC / Depth / Trades
// ---------------------------------------------------------------------------

export function toTicker(pair: string, raw: Raw): Ticker {
  let data = asRaw(raw[pair] ?? raw);
  if (!data || typeof data !== 'object') data = raw;
  const a = arr(data.a);
  const b = arr(data.b);
  const c = arr(data.c);
  const v = arr(data.v);
  const p = arr(data.p);
  const t = arr(data.t);
  const l = arr(data.l);
  const h = arr(data.h);
  return {
    venueId: VENUE_ID,
    pair,
    ask: s(a[0]),
    bid: s(b[0]),
    lastTradePrice: s(c[0]),
    lastTradeVolume: c.length > 1 ? s(c[1]) : '0',
    volume24h: v.length > 1 ? s(v[1]) : s(v[0]),
    vwap24h: p.length > 1 ? s(p[1]) : s(p[0]),
    tradeCount24h: t.length > 1 ? num(t[1]) : num(t[0]),
    low24h: l.length > 1 ? s(l[1]) : s(l[0]),
    high24h: h.length > 1 ? s(h[1]) : s(h[0]),
    open24h: s(data.o, '0'),
  };
}

function firstListValue(raw: Raw): unknown[] {
  for (const [k, val] of Object.entries(raw)) {
    if (k !== 'last' && Array.isArray(val)) return val;
  }
  return [];
}

export function toOhlcSeries(pair: string, interval: number, raw: Raw): OhlcSeries {
  const last = num(raw.last, 0);
  const series = Array.isArray(raw[pair]) ? (raw[pair] as unknown[]) : firstListValue(raw);
  const candles: OhlcCandle[] = [];
  for (const row of series) {
    if (!Array.isArray(row) || row.length < 8) continue;
    candles.push({
      time: num(row[0]),
      open: s(row[1]),
      high: s(row[2]),
      low: s(row[3]),
      close: s(row[4]),
      vwap: s(row[5]),
      volume: s(row[6]),
      count: num(row[7]),
    });
  }
  return { venueId: VENUE_ID, pair, intervalMinutes: interval, candles, last };
}

export function toOrderBook(pair: string, raw: Raw): OrderBook {
  let book = asRaw(raw[pair]);
  if (!('asks' in book)) {
    for (const val of Object.values(raw)) {
      if (val && typeof val === 'object' && 'asks' in (val as Raw)) {
        book = val as Raw;
        break;
      }
    }
  }
  const level = (row: unknown): OrderBookLevel => {
    const r = arr(row);
    return { price: s(r[0]), volume: s(r[1]), timestamp: num(r[2]) };
  };
  return {
    venueId: VENUE_ID,
    pair,
    asks: arr(book.asks).map(level),
    bids: arr(book.bids).map(level),
  };
}

function sideFromFlag(flag: string): OrderSide {
  return flag === 'b' ? 'buy' : 'sell';
}

function ordertypeFromFlag(flag: string): string {
  return flag === 'm' ? 'market' : 'limit';
}

export function toRecentTrades(pair: string, raw: Raw): RecentTrades {
  const last = s(raw.last, '');
  const series = Array.isArray(raw[pair]) ? (raw[pair] as unknown[]) : firstListValue(raw);
  const trades: PublicTrade[] = [];
  for (const row of series) {
    if (!Array.isArray(row) || row.length < 5) continue;
    trades.push({
      price: s(row[0]),
      volume: s(row[1]),
      time: num(row[2]),
      side: sideFromFlag(String(row[3])),
      ordertype: ordertypeFromFlag(String(row[4])),
      tradeId: row.length > 6 ? num(row[6]) : 0,
    });
  }
  return { venueId: VENUE_ID, pair, trades, last };
}

// ---------------------------------------------------------------------------
// Order receipt / detail
// ---------------------------------------------------------------------------

const VALID_ORDER_TYPES: ReadonlySet<string> = new Set<OrderType>([
  'market',
  'limit',
  'stop-loss',
  'stop-loss-limit',
  'take-profit',
  'take-profit-limit',
  'trailing-stop',
  'trailing-stop-limit',
]);

function mapOrderStatus(krakenStatus: string): OrderStatus {
  switch (krakenStatus) {
    case 'pending':
      return 'pending';
    case 'open':
      return 'open';
    case 'closed':
      return 'closed';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
    case 'expired':
      return 'expired';
    default:
      return 'pending';
  }
}

export function toOrderReceipt(
  raw: Raw,
  pair: string,
  side: OrderSide,
  ordertype: OrderType,
  volume: string,
  price?: string,
): OrderReceipt {
  let txids: string[] = [];
  if (Array.isArray(raw.txid)) txids = raw.txid.map(String);
  else if (typeof raw.txid === 'string') txids = [raw.txid];
  const descr = asRaw(raw.descr);
  const orderDescr = descr.order !== undefined ? String(descr.order) : '';
  return {
    venueId: VENUE_ID,
    txid: txids,
    descr: orderDescr,
    pair,
    side,
    ordertype,
    volume,
    price,
    status: txids.length > 0 ? 'open' : 'pending',
    submittedAt: new Date().toISOString(),
  };
}

export function toOrderDetail(txid: string, raw: Raw): OrderDetail {
  const descr = asRaw(raw.descr);
  const notZero = (v: unknown): boolean => v !== undefined && v !== null && v !== '0' && v !== 0;
  return {
    venueId: VENUE_ID,
    txid,
    userref: raw.userref !== undefined && raw.userref !== null ? num(raw.userref) : undefined,
    clOrdId: raw.cl_ord_id !== undefined && raw.cl_ord_id !== null ? String(raw.cl_ord_id) : undefined,
    status: mapOrderStatus(s(raw.status, 'pending')),
    opentm: unixToIso(raw.opentm ?? 0),
    closetm: optionalUnixIso(raw.closetm),
    expiretm: optionalUnixIso(raw.expiretm),
    descrPair: s(descr.pair, ''),
    descrType: s(descr.type, ''),
    descrOrdertype: s(descr.ordertype, ''),
    descrPrice: descr.price !== undefined && descr.price !== null ? s(descr.price) : undefined,
    descrPrice2: descr.price2 !== undefined && descr.price2 !== null ? s(descr.price2) : undefined,
    volume: s(raw.vol, '0'),
    volumeExecuted: s(raw.vol_exec, '0'),
    cost: s(raw.cost, '0'),
    fee: s(raw.fee, '0'),
    avgPrice: notZero(raw.price) ? s(raw.price) : undefined,
    stopPrice: notZero(raw.stopprice) ? s(raw.stopprice) : undefined,
    limitPrice: notZero(raw.limitprice) ? s(raw.limitprice) : undefined,
    trades: arr(raw.trades).map(String),
    reason: raw.reason !== undefined && raw.reason !== null ? String(raw.reason) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Trade detail
// ---------------------------------------------------------------------------

export function toTradeDetail(tradeId: string, raw: Raw): TradeDetail {
  const sideRaw = s(raw.type, 'buy').toLowerCase();
  const side: OrderSide = sideRaw === 'buy' ? 'buy' : 'sell';
  const ordertypeRaw = s(raw.ordertype, 'market');
  const ordertype: OrderType = VALID_ORDER_TYPES.has(ordertypeRaw)
    ? (ordertypeRaw as OrderType)
    : 'market';
  return {
    venueId: VENUE_ID,
    tradeId,
    orderTxid: s(raw.ordertxid, ''),
    pair: s(raw.pair, ''),
    time: unixToIso(raw.time ?? 0),
    side,
    ordertype,
    price: s(raw.price, '0'),
    cost: s(raw.cost, '0'),
    fee: s(raw.fee, '0'),
    volume: s(raw.vol, '0'),
  };
}

// ---------------------------------------------------------------------------
// Trade volume / fees
// ---------------------------------------------------------------------------

export function toTradeVolumeInfo(raw: Raw): TradeVolumeInfo {
  const currency = s(raw.currency, 'ZUSD');
  const volume30d = s(raw.volume, '0');
  const feesBlock = asRaw(raw.fees);
  const feesMakerBlock = asRaw(raw.fees_maker);
  const pairs = new Set([...Object.keys(feesBlock), ...Object.keys(feesMakerBlock)]);
  const fees: Record<string, PairFeeInfo> = {};
  for (const pair of pairs) {
    const takerInfo = asRaw(feesBlock[pair]);
    const makerInfo = asRaw(feesMakerBlock[pair]);
    const takerFee = num(takerInfo.fee, 0);
    const makerFee = num(makerInfo.fee, takerFee);
    const nextVolume = takerInfo.nextvolume ?? makerInfo.nextvolume;
    fees[pair] = {
      pair,
      takerFeePercent: takerFee,
      makerFeePercent: makerFee,
      volumeTier: s(takerInfo.tiervolume, ''),
      nextTierVolume: nextVolume !== undefined && nextVolume !== null ? s(nextVolume) : undefined,
    };
  }
  return { venueId: VENUE_ID, currency, volume30d, fees };
}
