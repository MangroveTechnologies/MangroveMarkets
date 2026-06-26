/**
 * Client-side CEX (Kraken) module — bring your own key.
 *
 * The user supplies their **own** Kraken API key/secret. The SDK signs locally
 * (HMAC-SHA512) and calls `api.kraken.com` directly; the key never reaches any
 * Mangrove service. Construction without credentials throws
 * `CredentialsRequiredError` — every CEX method is gated on the key.
 *
 * @example
 * ```ts
 * import { KrakenClient } from '@mangrove-ai/sdk';
 * const kraken = new KrakenClient({ apiKey: '...', apiSecret: '...' });
 * const balance = await kraken.getBalance();
 * ```
 */
export { KrakenClient } from './client';
export {
  CexError,
  CredentialsRequiredError,
  InvalidCredentialsError,
  PermissionDeniedError,
  OrderMinNotMetError,
  CostMinNotMetError,
  TickSizeInvalidError,
  InsufficientBalanceError,
  ValidationFailedError,
  PairNotFoundError,
  RateLimitedError,
  VenueUnavailableError,
  InvalidNonceError,
  UnknownCexError,
  mapError,
  translateErrors,
} from './errors';
export type { CexErrorEnvelope } from './errors';
export { signRequest } from './signing';
export * from './types';
