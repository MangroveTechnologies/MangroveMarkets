/**
 * Kraken request signing (HMAC-SHA512), nonce generation, and the tier-based
 * leaky-bucket rate limiter.
 *
 * Ported from the server's `src/cex/kraken/client.py`. The signing scheme is
 * Kraken's documented one:
 *
 *   API-Sign = base64(HMAC-SHA512(base64decode(secret),
 *                                 uri_path + SHA256(nonce + postdata)))
 *
 * Implemented with Node's `crypto`. This SDK targets Node (it uses native
 * `fetch` and `@types/node`); Kraken's private endpoints are not callable from
 * a browser anyway (CORS + key-exposure), so a Web Crypto fallback is
 * intentionally omitted — see the module note in client.ts.
 */
import { createHash, createHmac } from 'node:crypto';

/**
 * Compute the Kraken `API-Sign` header value for a signed request.
 *
 * @param apiSecret - Base64-encoded Kraken private key (the user's own).
 * @param uriPath - Request path, e.g. `/0/private/Balance`.
 * @param nonce - The nonce string included in the post body.
 * @param postData - URL-encoded request body (must include `nonce=...`).
 * @returns Base64-encoded HMAC-SHA512 signature.
 */
export function signRequest(
  apiSecret: string,
  uriPath: string,
  nonce: string,
  postData: string,
): string {
  // SHA256(nonce + postdata)
  const sha256 = createHash('sha256').update(nonce + postData, 'utf8').digest();
  // message = uri_path bytes + sha256 digest
  const message = Buffer.concat([Buffer.from(uriPath, 'utf8'), sha256]);
  // HMAC-SHA512 keyed by the base64-decoded secret
  const key = Buffer.from(apiSecret, 'base64');
  const hmac = createHmac('sha512', key).update(message).digest('base64');
  return hmac;
}

/**
 * Monotonic nonce generator with a same-millisecond collision guard.
 * One instance per client; produces strictly increasing string nonces.
 */
export class NonceGenerator {
  private lastNonce = 0;

  next(): string {
    let candidate = Date.now();
    if (candidate <= this.lastNonce) {
      candidate = this.lastNonce + 1;
    }
    this.lastNonce = candidate;
    return String(candidate);
  }
}

export interface TierLimit {
  restMax: number;
  restDecay: number;
  tradingMax: number;
  tradingDecay: number;
}

/** Tier-based limits — ported verbatim from the server `TIER_LIMITS`. */
export const TIER_LIMITS: Record<string, TierLimit> = {
  starter: { restMax: 15.0, restDecay: 0.33, tradingMax: 60.0, tradingDecay: 1.0 },
  intermediate: { restMax: 20.0, restDecay: 0.5, tradingMax: 125.0, tradingDecay: 2.34 },
  pro: { restMax: 20.0, restDecay: 1.0, tradingMax: 180.0, tradingDecay: 3.75 },
};

/** Paths that cost +4 on the REST counter (Kraken rate-limit schedule). */
const LEDGER_TRADE_PATHS = new Set([
  '/0/private/Ledgers',
  '/0/private/QueryLedgers',
  '/0/private/TradesHistory',
  '/0/private/QueryTrades',
]);

export function restCost(path: string): number {
  return LEDGER_TRADE_PATHS.has(path) ? 4.0 : 1.0;
}

/** Leaky-bucket counter with max capacity and per-second decay. */
export class RateCounter {
  private value = 0;
  private lastUpdate: number;

  constructor(
    readonly cap: number,
    readonly decay: number,
    private now: () => number = () => Date.now() / 1000,
  ) {
    this.lastUpdate = this.now();
  }

  private drain(): void {
    const t = this.now();
    const elapsed = t - this.lastUpdate;
    this.lastUpdate = t;
    if (elapsed > 0) {
      this.value = Math.max(0, this.value - elapsed * this.decay);
    }
  }

  add(cost: number): void {
    this.drain();
    this.value += cost;
  }

  current(): number {
    this.drain();
    return this.value;
  }

  /** Seconds needed to decay from the current value back down to `target`. */
  secondsUntil(target: number): number {
    this.drain();
    if (this.value <= target || this.decay <= 0) {
      return 0;
    }
    return (this.value - target) / this.decay;
  }
}
