"""Client-side signed HTTP client for Kraken (BYOK).

Ported from the MangroveMarkets-MCP-Server ``src/cex/kraken/client.py``. This
is the relocated, battle-tested signing layer — moved out of the server so the
user's Kraken key never leaves their machine. It runs **inside the SDK**, holds
the *user's* key locally, signs locally, and calls ``api.kraken.com`` directly.

Differences from the server original:
  * Synchronous (``httpx.Client``, ``threading.Lock``, ``time.sleep``) to match
    the rest of the MangroveMarkets Python SDK, which is sync end-to-end.
    The signing scheme, nonce strategy, rate-limit math, and credential
    scrubbing are byte-for-byte equivalent.
  * Raises ``CredentialsRequiredError`` on construction when the key/secret are
    missing or blank — the BYOK gate.

Handles:
  - API signing per Kraken spec (HMAC-SHA512 over path + SHA256(nonce + body))
  - Monotonic nonce generation with same-ms collision guard
  - Two in-memory rate-limit counters (REST + trading engine) with tier limits
  - Exponential backoff + single retry on rate-limit or invalid-nonce errors
  - Credential scrubbing for any logger attached to this module
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import threading
import time
from typing import Any
from urllib.parse import urlencode

import httpx

from .errors import CredentialsRequiredError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class KrakenApiError(Exception):
    """Raised when Kraken returns one or more error strings in its response.

    Carries the list of raw Kraken error strings so the SDK layer can
    translate them into structured ``CexError`` codes.
    """

    def __init__(self, errors: list[str], status_code: int = 0) -> None:
        self.errors = errors
        self.status_code = status_code
        super().__init__("; ".join(errors) or "Unknown Kraken error")


# ---------------------------------------------------------------------------
# Credential scrubber
# ---------------------------------------------------------------------------


class _CredentialScrubber(logging.Filter):
    """Log filter that redacts secrets from any formatted log record.

    Installed on this module's logger at construction time. It scans the
    fully-formatted message (and any string args) for the raw secret and
    any live key, replacing them with '***REDACTED***'.
    """

    def __init__(self, *sensitive: str) -> None:
        super().__init__()
        # Keep non-empty sensitive values; treat very short values as unsafe to redact.
        self._values = [v for v in sensitive if v and len(v) >= 8]

    def filter(self, record: logging.LogRecord) -> bool:
        if not self._values:
            return True
        try:
            msg = record.getMessage()
        except Exception:
            msg = str(record.msg)
        redacted = msg
        for value in self._values:
            if value in redacted:
                redacted = redacted.replace(value, "***REDACTED***")
        if redacted != msg:
            record.msg = redacted
            record.args = ()
        return True


def install_scrubber(secret: str, api_key: str | None = None) -> _CredentialScrubber:
    """Attach a credential scrubber to this module's logger.

    Returns the filter for test introspection. Safe to call multiple times.
    """
    scrubber = _CredentialScrubber(secret, api_key or "")
    logger.addFilter(scrubber)
    return scrubber


# ---------------------------------------------------------------------------
# Rate limits
# ---------------------------------------------------------------------------


TIER_LIMITS: dict[str, dict[str, float]] = {
    # REST API counter (shared across most private endpoints). Ledger/trade
    # history endpoints cost +4 instead of +1.
    #
    # Trading-engine counter (AddOrder/CancelOrder). Fast cancels within
    # 10s of placement cost +8.
    "starter": {
        "rest_max": 15.0,
        "rest_decay": 0.33,
        "trading_max": 60.0,
        "trading_decay": 1.0,
    },
    "intermediate": {
        "rest_max": 20.0,
        "rest_decay": 0.5,
        "trading_max": 125.0,
        "trading_decay": 2.34,
    },
    "pro": {
        "rest_max": 20.0,
        "rest_decay": 1.0,
        "trading_max": 180.0,
        "trading_decay": 3.75,
    },
}


# Paths that cost +4 on the REST counter (Kraken rate-limit schedule).
_LEDGER_TRADE_PATHS = {
    "/0/private/Ledgers",
    "/0/private/QueryLedgers",
    "/0/private/TradesHistory",
    "/0/private/QueryTrades",
}


def _rest_cost(path: str) -> float:
    return 4.0 if path in _LEDGER_TRADE_PATHS else 1.0


class _RateCounter:
    """Leaky-bucket counter with max capacity and per-second decay."""

    def __init__(self, cap: float, decay_per_sec: float) -> None:
        self.cap = cap
        self.decay = decay_per_sec
        self.value = 0.0
        self.last_update = time.monotonic()

    def _drain(self) -> None:
        now = time.monotonic()
        elapsed = now - self.last_update
        self.last_update = now
        if elapsed > 0:
            self.value = max(0.0, self.value - elapsed * self.decay)

    def add(self, cost: float) -> None:
        self._drain()
        self.value += cost

    def current(self) -> float:
        self._drain()
        return self.value

    def seconds_until(self, target: float) -> float:
        """Seconds needed to decay from current value back down to target."""
        self._drain()
        if self.value <= target or self.decay <= 0:
            return 0.0
        return (self.value - target) / self.decay


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class KrakenHttpClient:
    """Synchronous, signed HTTP transport for the Kraken REST API.

    This is the low-level transport: nonce -> sign -> POST -> parse -> raise
    ``KrakenApiError`` on Kraken error strings. The user-facing, typed surface
    is :class:`mangrove_markets.cex.KrakenClient`, which composes this transport
    with the ``public``/``private`` wrappers, ``mapping``, and error translation.

    BYOK: the API key and secret are the **user's own**. They are used only to
    sign requests sent directly to ``api.kraken.com`` — they are never
    transmitted to any Mangrove service.

    Construction fails with :class:`CredentialsRequiredError` if either the key
    or the secret is missing or blank — every CEX method is gated on the key.
    """

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        base_url: str = "https://api.kraken.com",
        tier: str = "intermediate",
        timeout: float = 15.0,
    ) -> None:
        if not (api_key and api_key.strip()) or not (api_secret and api_secret.strip()):
            raise CredentialsRequiredError()

        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = base_url
        self.tier = tier
        self.timeout = timeout

        limits = TIER_LIMITS.get(tier, TIER_LIMITS["intermediate"])
        self.rest_counter = _RateCounter(limits["rest_max"], limits["rest_decay"])
        self.trading_counter = _RateCounter(
            limits["trading_max"], limits["trading_decay"]
        )

        self._nonce_lock = threading.Lock()
        self._last_nonce = 0
        self._http: httpx.Client | None = None
        # Tracks recent AddOrder txids to their placement wall-clock time so
        # fast cancels (within 10s) can be billed at +8.
        self._recent_orders: dict[str, float] = {}

        install_scrubber(api_secret, api_key)

    # ------------------------------------------------------------------
    # Nonce
    # ------------------------------------------------------------------

    def _next_nonce(self) -> str:
        with self._nonce_lock:
            candidate = int(time.time() * 1000)
            if candidate <= self._last_nonce:
                candidate = self._last_nonce + 1
            self._last_nonce = candidate
            return str(candidate)

    # ------------------------------------------------------------------
    # Signing
    # ------------------------------------------------------------------

    def _sign(self, uri_path: str, nonce: str, postdata: str) -> str:
        encoded = (nonce + postdata).encode()
        message = uri_path.encode() + hashlib.sha256(encoded).digest()
        mac = hmac.new(base64.b64decode(self.api_secret), message, hashlib.sha512)
        return base64.b64encode(mac.digest()).decode()

    # ------------------------------------------------------------------
    # Rate-limit gate
    # ------------------------------------------------------------------

    def _gate_rest(self, cost: float) -> None:
        soft_cap = self.rest_counter.cap * 0.8
        if self.rest_counter.current() + cost > soft_cap:
            wait = self.rest_counter.seconds_until(soft_cap - cost)
            if wait > 0:
                logger.debug("REST rate soft-cap; sleeping %.3fs", wait)
                time.sleep(wait)
        self.rest_counter.add(cost)

    def _gate_trading(self, cost: float) -> None:
        soft_cap = self.trading_counter.cap * 0.8
        if self.trading_counter.current() + cost > soft_cap:
            wait = self.trading_counter.seconds_until(soft_cap - cost)
            if wait > 0:
                logger.debug("Trading rate soft-cap; sleeping %.3fs", wait)
                time.sleep(wait)
        self.trading_counter.add(cost)

    def _cancel_cost(self, txid: str | None) -> float:
        """+8 if cancelling within 10s of placement, +1 otherwise."""
        if not txid:
            return 1.0
        placed_at = self._recent_orders.get(txid)
        if placed_at is None:
            return 1.0
        return 8.0 if (time.time() - placed_at) < 10.0 else 1.0

    # ------------------------------------------------------------------
    # HTTP plumbing
    # ------------------------------------------------------------------

    def _get_http(self) -> httpx.Client:
        if self._http is None or self._http.is_closed:
            self._http = httpx.Client(base_url=self.base_url, timeout=self.timeout)
        return self._http

    def close(self) -> None:
        if self._http and not self._http.is_closed:
            self._http.close()

    # ------------------------------------------------------------------
    # Error parsing + retry helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _matches(errors: list[str], pattern: str) -> bool:
        return any(pattern in err for err in errors)

    @staticmethod
    def _extract_result(payload: dict[str, Any]) -> dict[str, Any]:
        errors = payload.get("error") or []
        if errors:
            raise KrakenApiError(errors)
        result = payload.get("result")
        if result is None:
            return {}
        return dict(result)

    # ------------------------------------------------------------------
    # Public GET
    # ------------------------------------------------------------------

    def public_get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self._gate_rest(_rest_cost(path))
        http = self._get_http()
        response = http.get(path, params=params)
        response.raise_for_status()
        return self._extract_result(response.json())

    # ------------------------------------------------------------------
    # Private POST (signed)
    # ------------------------------------------------------------------

    def private_post(self, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        body = dict[str, Any](body or {})

        # Pre-call gating: AddOrder/CancelOrder use the trading counter;
        # everything else uses the REST counter.
        if path == "/0/private/AddOrder":
            self._gate_trading(1.0)
        elif path == "/0/private/CancelOrder":
            self._gate_trading(self._cancel_cost(body.get("txid")))
        elif path == "/0/private/CancelAll":
            self._gate_trading(1.0)
        else:
            self._gate_rest(_rest_cost(path))

        try:
            result = self._do_private_post(path, body)
        except KrakenApiError as err:
            # Invalid nonce: one retry with fresh nonce
            if self._matches(err.errors, "EAPI:Invalid nonce"):
                logger.warning("Invalid nonce; retrying once")
                result = self._do_private_post(path, body)
            # Rate-limit exceeded: backoff + one retry
            elif self._matches(err.errors, "Rate limit exceeded"):
                logger.warning("Rate limit hit; backing off before retry")
                time.sleep(2.0)
                result = self._do_private_post(path, body)
            else:
                raise

        # Record AddOrder txids for fast-cancel accounting.
        if path == "/0/private/AddOrder":
            for txid in (result or {}).get("txid", []) or []:
                self._recent_orders[txid] = time.time()

        return result or {}

    def _do_private_post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        nonce = self._next_nonce()
        signed_body = {**body, "nonce": nonce}
        postdata = urlencode(signed_body)
        signature = self._sign(path, nonce, postdata)
        http = self._get_http()
        response = http.post(
            path,
            content=postdata,
            headers={
                "API-Key": self.api_key,
                "API-Sign": signature,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        response.raise_for_status()
        return self._extract_result(response.json())
