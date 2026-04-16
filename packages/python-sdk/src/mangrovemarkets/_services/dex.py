from __future__ import annotations

from typing import Any

from ..models.dex import (
    BroadcastResult,
    Quote,
    TradingPair,
    TransactionStatus,
    UnsignedTransaction,
    Venue,
)
from ..models.market_data import (
    Balances,
    ChartCandle,
    GasPrice,
    SpotPrice,
    TokenInfo,
    TokenSearchResult,
)
from ._base import BaseService


class DexService(BaseService):
    """DEX swap operations and market data utilities."""

    # -- Swap flow --

    def supported_venues(self) -> list[Venue]:
        data = self._call_tool("dex_supported_venues")
        return [Venue.model_validate(v) for v in data["venues"]]

    def supported_pairs(self, venue_id: str) -> list[TradingPair]:
        data = self._call_tool("dex_supported_pairs", {"venue_id": venue_id})
        return [TradingPair.model_validate(p) for p in data["pairs"]]

    def get_quote(
        self,
        input_token: str,
        output_token: str,
        amount: float,
        venue_id: str | None = None,
        chain_id: int | None = None,
        mode: str | None = None,
    ) -> Quote:
        params: dict[str, Any] = {
            "input_token": input_token,
            "output_token": output_token,
            "amount": amount,
        }
        if venue_id is not None:
            params["venue_id"] = venue_id
        if chain_id is not None:
            params["chain_id"] = chain_id
        if mode is not None:
            params["mode"] = mode
        return self._call_tool_model("dex_get_quote", Quote, params)

    def approve_token(
        self,
        token_address: str,
        chain_id: int,
        wallet_address: str,
        amount: float | None = None,
    ) -> UnsignedTransaction | None:
        params: dict[str, Any] = {
            "token_address": token_address,
            "chain_id": chain_id,
            "wallet_address": wallet_address,
        }
        if amount is not None:
            params["amount"] = amount
        data = self._call_tool("dex_approve_token", params)
        if data is None:
            return None
        return UnsignedTransaction.model_validate(data)

    def prepare_swap(
        self,
        quote_id: str,
        wallet_address: str,
        slippage: float = 1.0,
    ) -> UnsignedTransaction:
        return self._call_tool_model(
            "dex_prepare_swap",
            UnsignedTransaction,
            {
                "quote_id": quote_id,
                "wallet_address": wallet_address,
                "slippage": slippage,
            },
        )

    def broadcast(
        self,
        signed_tx: str,
        chain_id: int,
        venue_id: str | None = None,
        mev_protection: bool = False,
    ) -> BroadcastResult:
        params: dict[str, Any] = {"signed_tx": signed_tx, "chain_id": chain_id}
        if venue_id is not None:
            params["venue_id"] = venue_id
        if mev_protection:
            params["mev_protection"] = True
        return self._call_tool_model("dex_broadcast", BroadcastResult, params)

    def tx_status(
        self,
        tx_hash: str,
        chain_id: int,
        venue_id: str | None = None,
    ) -> TransactionStatus:
        params: dict[str, Any] = {"tx_hash": tx_hash, "chain_id": chain_id}
        if venue_id is not None:
            params["venue_id"] = venue_id
        return self._call_tool_model("dex_tx_status", TransactionStatus, params)

    # -- Market data --

    def balances(self, chain_id: int, wallet: str) -> Balances:
        return self._call_tool_model(
            "oneinch_balances",
            Balances,
            {"chain_id": chain_id, "wallet": wallet},
        )

    def allowances(self, chain_id: int, wallet: str, spender: str) -> Any:
        return self._call_tool(
            "oneinch_allowances",
            {"chain_id": chain_id, "wallet": wallet, "spender": spender},
        )

    def spot_price(self, chain_id: int, tokens: str) -> SpotPrice:
        return self._call_tool_model(
            "oneinch_spot_price",
            SpotPrice,
            {"chain_id": chain_id, "tokens": tokens},
        )

    def gas_price(self, chain_id: int) -> GasPrice:
        return self._call_tool_model(
            "oneinch_gas_price",
            GasPrice,
            {"chain_id": chain_id},
        )

    def token_search(self, chain_id: int, query: str) -> list[TokenSearchResult]:
        data = self._call_tool(
            "oneinch_token_search",
            {"chain_id": chain_id, "query": query},
        )
        return [TokenSearchResult.model_validate(t) for t in data.get("tokens", [])]

    def token_info(self, chain_id: int, address: str) -> TokenInfo:
        return self._call_tool_model(
            "oneinch_token_info",
            TokenInfo,
            {"chain_id": chain_id, "address": address},
        )

    def chart(
        self,
        chain_id: int,
        token0: str,
        token1: str,
        period: str = "1h",
    ) -> list[ChartCandle]:
        data = self._call_tool(
            "oneinch_chart",
            {
                "chain_id": chain_id,
                "token0": token0,
                "token1": token1,
                "period": period,
            },
        )
        return [ChartCandle.model_validate(c) for c in data.get("candles", [])]
