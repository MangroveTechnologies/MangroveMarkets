"""Pydantic models for the client-side CEX (Kraken) module.

Ported from the server's ``src/cex/models.py``. Money/volume/price fields are
strings to preserve exchange-provided precision.
"""
from __future__ import annotations

from enum import Enum

from ..models._base import MangroveModel

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP_LOSS = "stop-loss"
    STOP_LOSS_LIMIT = "stop-loss-limit"
    TAKE_PROFIT = "take-profit"
    TAKE_PROFIT_LIMIT = "take-profit-limit"
    TRAILING_STOP = "trailing-stop"
    TRAILING_STOP_LIMIT = "trailing-stop-limit"


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class TimeInForce(str, Enum):
    GTC = "GTC"  # Good-til-cancelled (default)
    IOC = "IOC"  # Immediate-or-cancel
    GTD = "GTD"  # Good-til-date


class OrderStatus(str, Enum):
    PENDING = "pending"
    OPEN = "open"
    CLOSED = "closed"
    CANCELED = "canceled"
    EXPIRED = "expired"


# ---------------------------------------------------------------------------
# Asset / Pair
# ---------------------------------------------------------------------------


class AssetInfo(MangroveModel):
    """Asset metadata from Kraken."""

    venue_id: str
    venue_symbol: str           # e.g., "XXBT" on Kraken
    altname: str                # e.g., "XBT"
    display_name: str           # e.g., "Bitcoin"
    decimals: int
    display_decimals: int


class PairInfo(MangroveModel):
    """Trading pair metadata."""

    venue_id: str
    venue_pair: str             # e.g., "XXBTZUSD" on Kraken
    altname: str                # e.g., "XBTUSD"
    ws_name: str | None = None  # e.g., "XBT/USD"
    base: str                   # base asset venue_symbol
    quote: str                  # quote asset venue_symbol
    price_decimals: int
    volume_decimals: int
    order_min: str              # minimum volume (string to preserve precision)
    cost_min: str               # minimum order cost in quote currency
    tick_size: str              # minimum price increment
    status: str                 # online, cancel_only, post_only, reduce_only
    taker_fee_percent: float
    maker_fee_percent: float


# ---------------------------------------------------------------------------
# Balance
# ---------------------------------------------------------------------------


class AssetBalance(MangroveModel):
    """Single-asset balance entry."""

    asset: str                  # venue_symbol (e.g., "XXBT")
    balance: str                # total balance
    hold_trade: str             # amount held for open orders
    available: str              # balance - hold_trade


class AccountBalance(MangroveModel):
    """Complete account balance snapshot."""

    venue_id: str
    balances: list[AssetBalance]
    fetched_at: str             # ISO 8601 UTC


class TradeBalance(MangroveModel):
    """Margin and equity summary."""

    venue_id: str
    reference_asset: str        # e.g., "ZUSD"
    equivalent_balance: str     # eb
    trade_balance: str          # tb
    margin_amount: str          # m
    unrealized_pnl: str         # n
    cost_basis: str             # c
    floating_valuation: str     # v
    equity: str                 # e
    free_margin: str            # mf
    margin_level: str | None = None  # ml (None if no positions)


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------


class CloseOrder(MangroveModel):
    """Conditional close spec for bracket orders."""

    ordertype: OrderType                # stop-loss, take-profit, or *-limit variants
    price: str                          # trigger price (supports relative: "-5%", "+100")
    price2: str | None = None        # limit price for *-limit types


class OrderRequest(MangroveModel):
    """Input for placing an order."""

    pair: str                           # pair altname or venue_pair
    side: OrderSide
    ordertype: OrderType
    volume: str                         # base currency volume
    price: str | None = None         # required for limit and trigger types
    price2: str | None = None        # required for *-limit trigger types
    time_in_force: TimeInForce = TimeInForce.GTC
    post_only: bool = False
    reduce_only: bool = False
    userref: int | None = None       # client reference id
    cl_ord_id: str | None = None     # client order id (max 18 chars)
    expire_time: str | None = None   # ISO 8601 for GTD
    close: CloseOrder | None = None  # bracket close
    validate_only: bool = False         # dry run


class OrderReceipt(MangroveModel):
    """Result of placing an order."""

    venue_id: str
    txid: list[str]                     # Kraken may return multiple (primary + close)
    descr: str                          # human-readable order description
    pair: str
    side: OrderSide
    ordertype: OrderType
    volume: str
    price: str | None = None
    status: OrderStatus
    submitted_at: str


class OrderDetail(MangroveModel):
    """Full order info from query/list."""

    venue_id: str
    txid: str
    userref: int | None = None
    cl_ord_id: str | None = None
    status: OrderStatus
    opentm: str                         # ISO 8601
    closetm: str | None = None
    expiretm: str | None = None
    descr_pair: str
    descr_type: str                     # buy/sell
    descr_ordertype: str
    descr_price: str | None = None
    descr_price2: str | None = None
    volume: str                         # requested
    volume_executed: str                # filled
    cost: str                           # executed cost in quote currency
    fee: str                            # fee paid
    avg_price: str | None = None
    stop_price: str | None = None
    limit_price: str | None = None
    trades: list[str] = []              # trade ids
    reason: str | None = None        # why closed/canceled


# ---------------------------------------------------------------------------
# Trade
# ---------------------------------------------------------------------------


class TradeDetail(MangroveModel):
    venue_id: str
    trade_id: str
    order_txid: str
    pair: str
    time: str                           # ISO 8601
    side: OrderSide
    ordertype: OrderType
    price: str
    cost: str
    fee: str
    volume: str


class PairFeeInfo(MangroveModel):
    pair: str
    taker_fee_percent: float
    maker_fee_percent: float
    volume_tier: str                    # description of current tier
    next_tier_volume: str | None = None


class TradeVolumeInfo(MangroveModel):
    venue_id: str
    currency: str                       # e.g., "ZUSD"
    volume_30d: str                     # 30-day trading volume
    fees: dict[str, PairFeeInfo]        # keyed by pair


# ---------------------------------------------------------------------------
# Market data
# ---------------------------------------------------------------------------


class Ticker(MangroveModel):
    venue_id: str
    pair: str
    ask: str
    bid: str
    last_trade_price: str
    last_trade_volume: str
    volume_24h: str
    vwap_24h: str
    trade_count_24h: int
    low_24h: str
    high_24h: str
    open_24h: str


class OhlcCandle(MangroveModel):
    time: int                           # unix timestamp
    open: str
    high: str
    low: str
    close: str
    vwap: str
    volume: str
    count: int


class OhlcSeries(MangroveModel):
    venue_id: str
    pair: str
    interval_minutes: int
    candles: list[OhlcCandle]
    last: int                           # timestamp for next-since


class OrderBookLevel(MangroveModel):
    price: str
    volume: str
    timestamp: int


class OrderBook(MangroveModel):
    venue_id: str
    pair: str
    asks: list[OrderBookLevel]
    bids: list[OrderBookLevel]


class PublicTrade(MangroveModel):
    price: str
    volume: str
    time: float
    side: OrderSide
    ordertype: str                      # "market" or "limit"
    trade_id: int


class RecentTrades(MangroveModel):
    venue_id: str
    pair: str
    trades: list[PublicTrade]
    last: str                           # cursor for next page


class VenueStatus(MangroveModel):
    venue_id: str
    status: str                         # online, cancel_only, post_only, maintenance
    checked_at: str
