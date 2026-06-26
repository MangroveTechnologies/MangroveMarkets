"""Convert raw Kraken JSON responses into Pydantic domain models.

Ported from the server's ``src/cex/kraken/mapping.py``. This module is where
Kraken's arcana — X/Z prefixes, float unix times, nested arrays, "X.HOLD"
sub-balances — stops leaking into the rest of the codebase. Everything above
this layer sees clean ``MangroveModel`` types.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .models import (
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
)

VENUE_ID = "kraken"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _s(value: Any, default: str = "0") -> str:
    """Coerce any numeric-like value to a string (preserves precision)."""
    if value is None:
        return default
    return str(value)


def _unix_float_to_iso(unix_ts: Any) -> str:
    try:
        dt = datetime.fromtimestamp(float(unix_ts), tz=timezone.utc)
    except (TypeError, ValueError):
        return ""
    return dt.isoformat().replace("+00:00", "Z")


def _optional_unix_iso(unix_ts: Any) -> str | None:
    if unix_ts in (None, 0, "0", 0.0):
        return None
    return _unix_float_to_iso(unix_ts)


def _price_decimals(raw: dict[str, Any]) -> int:
    # Kraken uses "pair_decimals" or "cost_decimals" depending on endpoint variant.
    return int(raw.get("pair_decimals", raw.get("cost_decimals", 8)))


def _volume_decimals(raw: dict[str, Any]) -> int:
    return int(raw.get("lot_decimals", raw.get("lot_multiplier", 8)))


def _tick_size(raw: dict[str, Any]) -> str:
    if "tick_size" in raw:
        return _s(raw["tick_size"])
    # Derive from pair_decimals: 10^-N
    decimals = _price_decimals(raw)
    return f"1e-{decimals}" if decimals > 0 else "1"


def _fee_for_zero_volume(raw: dict[str, Any], key: str = "fees") -> float:
    """Return the fee percentage for the base tier (0 volume).

    Kraken returns fees as ``[[volume_threshold, fee_pct], ...]``. The
    first entry is the default (no volume discount applied).
    """
    schedule = raw.get(key) or []
    if not schedule:
        return 0.0
    try:
        return float(schedule[0][1])
    except (IndexError, TypeError, ValueError):
        return 0.0


# ---------------------------------------------------------------------------
# Metadata: assets, pairs, venue status
# ---------------------------------------------------------------------------


def to_asset_info(venue_symbol: str, raw: dict[str, Any]) -> AssetInfo:
    return AssetInfo(
        venue_id=VENUE_ID,
        venue_symbol=venue_symbol,
        altname=str(raw.get("altname", venue_symbol)),
        display_name=str(raw.get("display_name") or raw.get("altname", venue_symbol)),
        decimals=int(raw.get("decimals", 8)),
        display_decimals=int(raw.get("display_decimals", 4)),
    )


def to_pair_info(venue_pair: str, raw: dict[str, Any]) -> PairInfo:
    maker_fees_key = "fees_maker" if "fees_maker" in raw else "fees"
    return PairInfo(
        venue_id=VENUE_ID,
        venue_pair=venue_pair,
        altname=str(raw.get("altname", venue_pair)),
        ws_name=raw.get("wsname"),
        base=str(raw.get("base", "")),
        quote=str(raw.get("quote", "")),
        price_decimals=_price_decimals(raw),
        volume_decimals=_volume_decimals(raw),
        order_min=_s(raw.get("ordermin", "0")),
        cost_min=_s(raw.get("costmin", "0")),
        tick_size=_tick_size(raw),
        status=str(raw.get("status", "online")),
        taker_fee_percent=_fee_for_zero_volume(raw, "fees"),
        maker_fee_percent=_fee_for_zero_volume(raw, maker_fees_key),
    )


def to_venue_status(raw: dict[str, Any]) -> VenueStatus:
    return VenueStatus(
        venue_id=VENUE_ID,
        status=str(raw.get("status", "unknown")),
        checked_at=str(raw.get("timestamp") or datetime.now(timezone.utc).isoformat()),
    )


# ---------------------------------------------------------------------------
# Balances
# ---------------------------------------------------------------------------


def to_account_balance(raw: dict[str, Any]) -> AccountBalance:
    """Map a BalanceEx response (dict of {asset: {balance, hold_trade}}) to AccountBalance.

    Plain ``Balance`` responses return scalars; BalanceEx returns dicts.
    We accept both shapes. "X.HOLD" sub-balances are preserved as separate
    AssetBalance entries.
    """
    entries: list[AssetBalance] = []
    for asset, payload in (raw or {}).items():
        if isinstance(payload, dict):
            total = _s(payload.get("balance", "0"))
            hold = _s(payload.get("hold_trade", "0"))
            credit = _s(payload.get("credit", "0"))
            try:
                available_value = float(total) - float(hold) + float(credit)
                available = f"{available_value:.10f}".rstrip("0").rstrip(".")
                if not available:
                    available = "0"
            except ValueError:
                available = total
            entries.append(
                AssetBalance(
                    asset=asset,
                    balance=total,
                    hold_trade=hold,
                    available=available,
                )
            )
        else:
            total = _s(payload, "0")
            entries.append(
                AssetBalance(
                    asset=asset,
                    balance=total,
                    hold_trade="0",
                    available=total,
                )
            )
    return AccountBalance(
        venue_id=VENUE_ID,
        balances=entries,
        fetched_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    )


def to_trade_balance(raw: dict[str, Any], ref_asset: str) -> TradeBalance:
    return TradeBalance(
        venue_id=VENUE_ID,
        reference_asset=ref_asset,
        equivalent_balance=_s(raw.get("eb", "0")),
        trade_balance=_s(raw.get("tb", "0")),
        margin_amount=_s(raw.get("m", "0")),
        unrealized_pnl=_s(raw.get("n", "0")),
        cost_basis=_s(raw.get("c", "0")),
        floating_valuation=_s(raw.get("v", "0")),
        equity=_s(raw.get("e", "0")),
        free_margin=_s(raw.get("mf", "0")),
        margin_level=_s(raw["ml"]) if raw.get("ml") is not None else None,
    )


# ---------------------------------------------------------------------------
# Ticker / OHLC / Depth / Trades
# ---------------------------------------------------------------------------


def to_ticker(pair: str, raw: dict[str, Any]) -> Ticker:
    # Kraken returns the response keyed by venue_pair. Caller may pass the
    # full response dict or the inner ticker fields; accept both.
    data = raw.get(pair, raw)
    # Bail early if the response wasn't keyed by our pair and has no fields.
    if not isinstance(data, dict):
        data = raw
    return Ticker(
        venue_id=VENUE_ID,
        pair=pair,
        ask=_s((data.get("a") or ["0"])[0]),
        bid=_s((data.get("b") or ["0"])[0]),
        last_trade_price=_s((data.get("c") or ["0"])[0]),
        last_trade_volume=_s((data.get("c") or ["0", "0"])[1] if len(data.get("c") or []) > 1 else "0"),
        volume_24h=_s(
            (data.get("v") or ["0", "0"])[1] if len(data.get("v") or []) > 1 else (data.get("v") or ["0"])[0]
        ),
        vwap_24h=_s((data.get("p") or ["0", "0"])[1] if len(data.get("p") or []) > 1 else (data.get("p") or ["0"])[0]),
        trade_count_24h=int(
            (data.get("t") or [0, 0])[1] if len(data.get("t") or []) > 1 else (data.get("t") or [0])[0]
        ),
        low_24h=_s((data.get("l") or ["0", "0"])[1] if len(data.get("l") or []) > 1 else (data.get("l") or ["0"])[0]),
        high_24h=_s((data.get("h") or ["0", "0"])[1] if len(data.get("h") or []) > 1 else (data.get("h") or ["0"])[0]),
        open_24h=_s(data.get("o", "0")),
    )


def to_ohlc_series(pair: str, interval: int, raw: dict[str, Any]) -> OhlcSeries:
    last = int(raw.get("last", 0))
    series = raw.get(pair) or next(
        (v for k, v in raw.items() if k != "last" and isinstance(v, list)), []
    )
    candles: list[OhlcCandle] = []
    for row in series:
        if len(row) < 8:
            continue
        candles.append(
            OhlcCandle(
                time=int(row[0]),
                open=_s(row[1]),
                high=_s(row[2]),
                low=_s(row[3]),
                close=_s(row[4]),
                vwap=_s(row[5]),
                volume=_s(row[6]),
                count=int(row[7]),
            )
        )
    return OhlcSeries(
        venue_id=VENUE_ID,
        pair=pair,
        interval_minutes=interval,
        candles=candles,
        last=last,
    )


def to_order_book(pair: str, raw: dict[str, Any]) -> OrderBook:
    book = raw.get(pair) or next(
        (v for v in raw.values() if isinstance(v, dict) and "asks" in v), {}
    )
    asks = [
        OrderBookLevel(price=_s(row[0]), volume=_s(row[1]), timestamp=int(row[2]))
        for row in (book or {}).get("asks", [])
    ]
    bids = [
        OrderBookLevel(price=_s(row[0]), volume=_s(row[1]), timestamp=int(row[2]))
        for row in (book or {}).get("bids", [])
    ]
    return OrderBook(venue_id=VENUE_ID, pair=pair, asks=asks, bids=bids)


def _side_from_flag(flag: str) -> OrderSide:
    return OrderSide.BUY if flag == "b" else OrderSide.SELL


def _ordertype_from_flag(flag: str) -> str:
    return "market" if flag == "m" else "limit"


def to_recent_trades(pair: str, raw: dict[str, Any]) -> RecentTrades:
    last = str(raw.get("last", ""))
    series = raw.get(pair) or next(
        (v for k, v in raw.items() if k != "last" and isinstance(v, list)), []
    )
    trades: list[PublicTrade] = []
    for row in series:
        # Kraken returns: [price, volume, time, side, ordertype, miscellaneous, trade_id]
        if len(row) < 5:
            continue
        trade_id_val = row[6] if len(row) > 6 else 0
        try:
            trade_id_int = int(trade_id_val)
        except (TypeError, ValueError):
            trade_id_int = 0
        trades.append(
            PublicTrade(
                price=_s(row[0]),
                volume=_s(row[1]),
                time=float(row[2]),
                side=_side_from_flag(str(row[3])),
                ordertype=_ordertype_from_flag(str(row[4])),
                trade_id=trade_id_int,
            )
        )
    return RecentTrades(venue_id=VENUE_ID, pair=pair, trades=trades, last=last)


# ---------------------------------------------------------------------------
# Order receipt / detail
# ---------------------------------------------------------------------------


def _map_order_status(kraken_status: str) -> OrderStatus:
    mapping = {
        "pending": OrderStatus.PENDING,
        "open": OrderStatus.OPEN,
        "closed": OrderStatus.CLOSED,
        "canceled": OrderStatus.CANCELED,
        "cancelled": OrderStatus.CANCELED,
        "expired": OrderStatus.EXPIRED,
    }
    return mapping.get(kraken_status, OrderStatus.PENDING)


def to_order_receipt(
    raw: dict[str, Any],
    pair: str,
    side: OrderSide,
    ordertype: OrderType,
    volume: str,
    price: str | None = None,
) -> OrderReceipt:
    txids = raw.get("txid") or []
    if isinstance(txids, str):
        txids = [txids]
    descr = raw.get("descr") or {}
    order_descr = str(descr.get("order", "")) if isinstance(descr, dict) else ""
    return OrderReceipt(
        venue_id=VENUE_ID,
        txid=list(txids),
        descr=order_descr,
        pair=pair,
        side=side,
        ordertype=ordertype,
        volume=volume,
        price=price,
        status=OrderStatus.OPEN if txids else OrderStatus.PENDING,
        submitted_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    )


def to_order_detail(txid: str, raw: dict[str, Any]) -> OrderDetail:
    descr = raw.get("descr") or {}
    return OrderDetail(
        venue_id=VENUE_ID,
        txid=txid,
        userref=raw.get("userref"),
        cl_ord_id=raw.get("cl_ord_id"),
        status=_map_order_status(str(raw.get("status", "pending"))),
        opentm=_unix_float_to_iso(raw.get("opentm", 0)),
        closetm=_optional_unix_iso(raw.get("closetm")),
        expiretm=_optional_unix_iso(raw.get("expiretm")),
        descr_pair=str(descr.get("pair", "")),
        descr_type=str(descr.get("type", "")),
        descr_ordertype=str(descr.get("ordertype", "")),
        descr_price=_s(descr["price"]) if descr.get("price") is not None else None,
        descr_price2=_s(descr["price2"]) if descr.get("price2") is not None else None,
        volume=_s(raw.get("vol", "0")),
        volume_executed=_s(raw.get("vol_exec", "0")),
        cost=_s(raw.get("cost", "0")),
        fee=_s(raw.get("fee", "0")),
        avg_price=_s(raw["price"]) if raw.get("price") not in (None, "0", 0) else None,
        stop_price=_s(raw["stopprice"]) if raw.get("stopprice") not in (None, "0", 0) else None,
        limit_price=_s(raw["limitprice"]) if raw.get("limitprice") not in (None, "0", 0) else None,
        trades=list(raw.get("trades", []) or []),
        reason=raw.get("reason"),
    )


# ---------------------------------------------------------------------------
# Trade detail
# ---------------------------------------------------------------------------


def to_trade_detail(trade_id: str, raw: dict[str, Any]) -> TradeDetail:
    side_raw = str(raw.get("type", "buy")).lower()
    side = OrderSide.BUY if side_raw == "buy" else OrderSide.SELL
    ordertype_raw = str(raw.get("ordertype", "market"))
    try:
        ordertype = OrderType(ordertype_raw)
    except ValueError:
        ordertype = OrderType.MARKET
    return TradeDetail(
        venue_id=VENUE_ID,
        trade_id=trade_id,
        order_txid=str(raw.get("ordertxid", "")),
        pair=str(raw.get("pair", "")),
        time=_unix_float_to_iso(raw.get("time", 0)),
        side=side,
        ordertype=ordertype,
        price=_s(raw.get("price", "0")),
        cost=_s(raw.get("cost", "0")),
        fee=_s(raw.get("fee", "0")),
        volume=_s(raw.get("vol", "0")),
    )


# ---------------------------------------------------------------------------
# Trade volume / fees
# ---------------------------------------------------------------------------


def to_trade_volume_info(raw: dict[str, Any]) -> TradeVolumeInfo:
    currency = str(raw.get("currency", "ZUSD"))
    volume_30d = _s(raw.get("volume", "0"))

    per_pair: dict[str, PairFeeInfo] = {}
    fees_block = raw.get("fees") or {}
    fees_maker_block = raw.get("fees_maker") or {}
    pairs = set(fees_block.keys()) | set(fees_maker_block.keys())
    for pair in pairs:
        taker_info = fees_block.get(pair) or {}
        maker_info = fees_maker_block.get(pair) or {}
        taker_fee = float(taker_info.get("fee", 0.0) or 0.0)
        maker_fee = float(maker_info.get("fee", taker_fee) or taker_fee)
        next_volume = taker_info.get("nextvolume") or maker_info.get("nextvolume")
        per_pair[pair] = PairFeeInfo(
            pair=pair,
            taker_fee_percent=taker_fee,
            maker_fee_percent=maker_fee,
            volume_tier=str(taker_info.get("tiervolume", "")),
            next_tier_volume=_s(next_volume) if next_volume is not None else None,
        )

    return TradeVolumeInfo(
        venue_id=VENUE_ID,
        currency=currency,
        volume_30d=volume_30d,
        fees=per_pair,
    )
