"""User-facing, typed client-side Kraken client (BYOK).

``KrakenClient`` is the public entry point of the CEX module. It composes:

  * :class:`KrakenHttpClient` — the relocated signing transport (HMAC-SHA512,
    monotonic nonce, tier-based leaky-bucket rate limiting, credential scrubber).
  * the ``public`` / ``private`` endpoint wrappers.
  * ``mapping`` — Kraken JSON -> Pydantic domain models.
  * ``error_mapping`` — Kraken error strings -> structured ``CexError`` codes.

BYOK contract: the user supplies their **own** Kraken API key/secret. The SDK
signs locally and calls ``api.kraken.com`` directly; the key never goes to any
Mangrove service. Construction without a key/secret raises
:class:`CredentialsRequiredError` — every CEX method is gated on the key.

Deviation from the server adapter: the server resolved every pair/asset alias
to its Kraken canonical symbol via a cached ``AssetPairs`` lookup before each
call. The SDK passes the caller-supplied pair/asset through to Kraken directly
(Kraken's REST API accepts altnames such as ``XBTUSD`` as well as canonical
``XXBTZUSD``), avoiding an extra metadata round-trip per call. Callers wanting
canonical metadata can call :meth:`get_asset_pairs` / :meth:`get_assets`.
"""
from __future__ import annotations

from typing import Any

from . import mapping
from . import private as _private
from . import public as _public
from .client import KrakenApiError, KrakenHttpClient
from .error_mapping import translate
from .models import (
    AccountBalance,
    AssetInfo,
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
)

VENUE_ID = "kraken"


# ---------------------------------------------------------------------------
# OrderRequest -> Kraken AddOrder params (ported from the server adapter)
# ---------------------------------------------------------------------------


def _build_add_order_params(req: OrderRequest, force_validate: bool = False) -> dict[str, Any]:
    """Translate an OrderRequest into the flat Kraken AddOrder body.

    Only includes params the request actually set, so Kraken uses its own
    defaults for omitted optional fields.
    """
    params: dict[str, Any] = {
        "pair": req.pair,
        "type": req.side.value,
        "ordertype": req.ordertype.value,
        "volume": req.volume,
    }

    if req.price is not None:
        params["price"] = req.price
    if req.price2 is not None:
        params["price2"] = req.price2

    # GTC is Kraken's implicit default; only send IOC / GTD.
    if req.time_in_force and req.time_in_force.value != "GTC":
        params["timeinforce"] = req.time_in_force.value

    oflags: list[str] = []
    if req.post_only:
        oflags.append("post")
    if oflags:
        params["oflags"] = ",".join(oflags)

    if req.reduce_only:
        params["reduce_only"] = True

    if req.userref is not None:
        params["userref"] = req.userref
    if req.cl_ord_id is not None:
        params["cl_ord_id"] = req.cl_ord_id

    if req.expire_time:
        params["expiretm"] = req.expire_time

    if req.close is not None:
        params["close[ordertype]"] = req.close.ordertype.value
        params["close[price]"] = req.close.price
        if req.close.price2 is not None:
            params["close[price2]"] = req.close.price2

    if force_validate or req.validate_only:
        params["validate"] = True

    return params


# ---------------------------------------------------------------------------
# KrakenClient
# ---------------------------------------------------------------------------


class KrakenClient:
    """Client-side, typed Kraken client. Bring your own key.

    Args:
        api_key: Your Kraken API key. Required.
        api_secret: Your Kraken API private key (base64). Required.
        base_url: Kraken REST base URL. Defaults to ``https://api.kraken.com``.
        tier: Kraken verification tier for rate-limit shaping
            (``"starter"`` | ``"intermediate"`` | ``"pro"``). Default
            ``"intermediate"``.
        timeout: Per-request timeout in seconds. Default 15.

    Raises:
        CredentialsRequiredError: if ``api_key`` or ``api_secret`` is missing/blank.
    """

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        *,
        base_url: str = "https://api.kraken.com",
        tier: str = "intermediate",
        timeout: float = 15.0,
    ) -> None:
        # KrakenHttpClient enforces the credential gate on construction.
        self._client = KrakenHttpClient(
            api_key=api_key,
            api_secret=api_secret,
            base_url=base_url,
            tier=tier,
            timeout=timeout,
        )

    # ------------------------------------------------------------------
    # Public market data
    # ------------------------------------------------------------------

    def get_server_time(self) -> dict[str, Any]:
        """Kraken server time (raw ``{unixtime, rfc1123}``)."""
        try:
            return _public.server_time(self._client)
        except KrakenApiError as err:
            raise translate(err) from err

    def get_system_status(self) -> VenueStatus:
        """Kraken system status (online / cancel_only / maintenance)."""
        try:
            raw = _public.system_status(self._client)
        except KrakenApiError as err:
            raise translate(err) from err
        return mapping.to_venue_status(raw)

    def get_assets(self, asset: str | None = None) -> list[AssetInfo]:
        """List asset metadata, optionally filtered to one asset."""
        try:
            raw = _public.assets(self._client, asset=asset)
        except KrakenApiError as err:
            raise translate(err) from err
        return [mapping.to_asset_info(symbol, info) for symbol, info in (raw or {}).items()]

    def get_asset_pairs(self, pair: str | None = None) -> list[PairInfo]:
        """List trading-pair metadata, optionally filtered to one pair."""
        try:
            raw = _public.asset_pairs(self._client, pair=pair)
        except KrakenApiError as err:
            raise translate(err) from err
        return [mapping.to_pair_info(p, info) for p, info in (raw or {}).items()]

    def get_ticker(self, pair: str) -> Ticker:
        """Ticker snapshot for a pair."""
        try:
            raw = _public.ticker(self._client, pair)
        except KrakenApiError as err:
            raise translate(err) from err
        # Kraken keys the response by its canonical pair; pass the first key
        # so the mapper finds the inner block regardless of altname vs canonical.
        keyed = next(iter(raw), pair) if isinstance(raw, dict) and raw else pair
        return mapping.to_ticker(keyed, raw)

    def get_ohlc(
        self, pair: str, interval: int = 1, since: int | None = None
    ) -> OhlcSeries:
        """OHLC candles for a pair. ``interval`` is in minutes."""
        try:
            raw = _public.ohlc(self._client, pair, interval=interval, since=since)
        except KrakenApiError as err:
            raise translate(err) from err
        return mapping.to_ohlc_series(pair, interval, raw)

    def get_order_book(self, pair: str, count: int | None = None) -> OrderBook:
        """Order book (depth) for a pair."""
        try:
            raw = _public.depth(self._client, pair, count=count)
        except KrakenApiError as err:
            raise translate(err) from err
        return mapping.to_order_book(pair, raw)

    # Alias matching the Kraken endpoint name.
    get_depth = get_order_book

    def get_recent_trades(
        self, pair: str, since: str | None = None
    ) -> RecentTrades:
        """Recent public trades for a pair."""
        try:
            raw = _public.trades(self._client, pair, since=since)
        except KrakenApiError as err:
            raise translate(err) from err
        return mapping.to_recent_trades(pair, raw)

    def get_spread(self, pair: str, since: str | None = None) -> dict[str, Any]:
        """Recent bid/ask spread data for a pair (raw Kraken result)."""
        try:
            return _public.spread(self._client, pair, since=since)
        except KrakenApiError as err:
            raise translate(err) from err

    # ------------------------------------------------------------------
    # Private — account / balance
    # ------------------------------------------------------------------

    def get_balance(self) -> AccountBalance:
        """Account balances (uses BalanceEx for hold/available detail)."""
        try:
            raw = _private.balance_ex(self._client)
        except KrakenApiError as err:
            raise translate(err) from err
        return mapping.to_account_balance(raw)

    def get_trade_balance(self, asset: str | None = None) -> TradeBalance:
        """Margin/equity summary in the given reference asset (default ZUSD)."""
        try:
            raw = _private.trade_balance(self._client, asset=asset)
        except KrakenApiError as err:
            raise translate(err) from err
        return mapping.to_trade_balance(raw, ref_asset=asset or "ZUSD")

    def get_trade_volume(
        self, pairs: list[str] | None = None
    ) -> TradeVolumeInfo:
        """30-day trade volume and per-pair fee schedule."""
        try:
            raw = _private.trade_volume(self._client, pair=pairs, fee_info=True)
        except KrakenApiError as err:
            raise translate(err) from err
        return mapping.to_trade_volume_info(raw)

    # ------------------------------------------------------------------
    # Private — order queries
    # ------------------------------------------------------------------

    def get_open_orders(self, userref: int | None = None) -> list[OrderDetail]:
        """Currently open orders."""
        try:
            raw = _private.open_orders(self._client, userref=userref)
        except KrakenApiError as err:
            raise translate(err) from err
        return [
            mapping.to_order_detail(txid, payload)
            for txid, payload in (raw.get("open") or {}).items()
        ]

    def get_closed_orders(
        self,
        start: int | None = None,
        end: int | None = None,
        offset: int = 0,
    ) -> list[OrderDetail]:
        """Closed orders (paginated via ``offset``)."""
        try:
            raw = _private.closed_orders(
                self._client, start=start, end=end, ofs=offset
            )
        except KrakenApiError as err:
            raise translate(err) from err
        return [
            mapping.to_order_detail(txid, payload)
            for txid, payload in (raw.get("closed") or {}).items()
        ]

    def query_orders(self, txids: list[str]) -> list[OrderDetail]:
        """Look up specific orders by txid."""
        try:
            raw = _private.query_orders(self._client, txids)
        except KrakenApiError as err:
            raise translate(err) from err
        return [
            mapping.to_order_detail(txid, payload)
            for txid, payload in (raw or {}).items()
        ]

    # ------------------------------------------------------------------
    # Private — trade history
    # ------------------------------------------------------------------

    def get_trades_history(
        self,
        start: int | None = None,
        end: int | None = None,
        offset: int = 0,
    ) -> list[TradeDetail]:
        """Historical trades (paginated via ``offset``)."""
        try:
            raw = _private.trades_history(
                self._client, start=start, end=end, ofs=offset
            )
        except KrakenApiError as err:
            raise translate(err) from err
        return [
            mapping.to_trade_detail(trade_id, payload)
            for trade_id, payload in (raw.get("trades") or {}).items()
        ]

    def query_trades(self, txids: list[str]) -> list[TradeDetail]:
        """Look up specific trades by id."""
        try:
            raw = _private.query_trades(self._client, txids)
        except KrakenApiError as err:
            raise translate(err) from err
        return [
            mapping.to_trade_detail(trade_id, payload)
            for trade_id, payload in (raw or {}).items()
        ]

    # ------------------------------------------------------------------
    # Private — order management
    # ------------------------------------------------------------------

    def add_order(self, req: OrderRequest) -> OrderReceipt:
        """Place an order. Set ``req.validate_only=True`` for a dry run."""
        try:
            params = _build_add_order_params(req)
            raw = _private.add_order(self._client, **params)
        except KrakenApiError as err:
            raise translate(err) from err
        return mapping.to_order_receipt(
            raw,
            pair=req.pair,
            side=req.side,
            ordertype=req.ordertype,
            volume=req.volume,
            price=req.price,
        )

    def validate_order(self, req: OrderRequest) -> OrderReceipt:
        """Dry-run an order against Kraken without placing it."""
        try:
            params = _build_add_order_params(req, force_validate=True)
            raw = _private.add_order(self._client, **params)
        except KrakenApiError as err:
            raise translate(err) from err
        return mapping.to_order_receipt(
            raw,
            pair=req.pair,
            side=req.side,
            ordertype=req.ordertype,
            volume=req.volume,
            price=req.price,
        )

    def edit_order(self, txid: str, req: OrderRequest) -> OrderReceipt:
        """Edit an existing order. Mirrors AddOrder minus validate/close/bracket."""
        try:
            params: dict[str, Any] = {"pair": req.pair, "volume": req.volume}
            if req.price is not None:
                params["price"] = req.price
            if req.price2 is not None:
                params["price2"] = req.price2
            if req.userref is not None:
                params["userref"] = req.userref
            if req.cl_ord_id is not None:
                params["cl_ord_id"] = req.cl_ord_id
            oflags: list[str] = []
            if req.post_only:
                oflags.append("post")
            if oflags:
                params["oflags"] = ",".join(oflags)
            raw = _private.edit_order(self._client, txid, **params)
        except KrakenApiError as err:
            raise translate(err) from err
        return mapping.to_order_receipt(
            raw,
            pair=req.pair,
            side=req.side,
            ordertype=req.ordertype,
            volume=req.volume,
            price=req.price,
        )

    def cancel_order(self, txid: str) -> dict[str, Any]:
        """Cancel a single order by txid."""
        try:
            raw = _private.cancel_order(self._client, txid)
        except KrakenApiError as err:
            raise translate(err) from err
        return {
            "canceled": int(raw.get("count", 0) or 0),
            "pending": bool(raw.get("pending", False)),
        }

    def cancel_all(self) -> dict[str, Any]:
        """Cancel all open orders."""
        try:
            raw = _private.cancel_all(self._client)
        except KrakenApiError as err:
            raise translate(err) from err
        return {"count": int(raw.get("count", 0) or 0)}

    # ------------------------------------------------------------------
    # Teardown
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Close the underlying HTTP connection."""
        self._client.close()

    def __enter__(self) -> KrakenClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
