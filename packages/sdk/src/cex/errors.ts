/**
 * Client-side CEX errors for the Kraken BYOK module.
 *
 * Produced **client-side** by the SDK. They mirror the structured error codes
 * from the (now-removed) server CEX implementation so agents that previously
 * consumed `cex_*` tool errors keep the same contract:
 *
 *   { error: true, code: "ERROR_CODE", message: "...", suggestion: "..." }
 *
 * Ported from the server's `src/cex/errors.py` + the adapter's `_map_error`.
 */

/** Structured error envelope agents consume. */
export interface CexErrorEnvelope {
  error: true;
  code: string;
  message: string;
  suggestion: string;
}

/** Base error for all CEX operations. */
export class CexError extends Error {
  readonly code: string;
  readonly suggestion: string;

  constructor(code: string, message: string, suggestion = '') {
    super(message);
    this.name = 'CexError';
    this.code = code;
    this.suggestion = suggestion;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Serialize to the structured error envelope. */
  toEnvelope(): CexErrorEnvelope {
    return { error: true, code: this.code, message: this.message, suggestion: this.suggestion };
  }
}

/**
 * Thrown when a {@link KrakenClient} is constructed without an API key/secret.
 * BYOK gate: no CEX method can run without the user's own Kraken credentials.
 */
export class CredentialsRequiredError extends CexError {
  constructor(message = 'Kraken API key and secret are required') {
    super(
      'CEX_CREDENTIALS_REQUIRED',
      message,
      'Supply your own Kraken API key to the KrakenClient constructor. The key never leaves your machine.',
    );
    this.name = 'CredentialsRequiredError';
  }
}

/** Kraken rejected the key/signature (wrong or revoked key). */
export class InvalidCredentialsError extends CexError {
  constructor(message = 'Invalid Kraken credentials') {
    super(
      'CEX_INVALID_CREDENTIALS',
      message,
      'Verify your Kraken API key and secret are correct and not revoked.',
    );
    this.name = 'InvalidCredentialsError';
  }
}

/** The key lacks the permission/scope for the action. */
export class PermissionDeniedError extends CexError {
  constructor(message = 'Permission denied by Kraken') {
    super(
      'CEX_PERMISSION_DENIED',
      message,
      'Verify the Kraken API key has the required permissions enabled.',
    );
    this.name = 'PermissionDeniedError';
  }
}

/** Order volume below the pair's `ordermin`. */
export class OrderMinNotMetError extends CexError {
  constructor(message = 'Order volume below minimum') {
    super('CEX_ORDER_MIN_NOT_MET', message, "Increase the order volume to meet the pair's minimum.");
    this.name = 'OrderMinNotMetError';
  }
}

/** Order cost below the pair's `costmin`. */
export class CostMinNotMetError extends CexError {
  constructor(message = 'Order cost below minimum') {
    super(
      'CEX_COST_MIN_NOT_MET',
      message,
      'Increase the volume or price so the total cost meets the minimum.',
    );
    this.name = 'CostMinNotMetError';
  }
}

/** Order price not aligned to the pair's tick size. */
export class TickSizeInvalidError extends CexError {
  constructor(message = 'Price not aligned to tick size') {
    super('CEX_TICK_SIZE_INVALID', message, "Round the price to a multiple of the pair's tick size.");
    this.name = 'TickSizeInvalidError';
  }
}

/** Not enough funds for the requested action. */
export class InsufficientBalanceError extends CexError {
  constructor(message = 'Insufficient balance') {
    super('CEX_INSUFFICIENT_BALANCE', message, 'Fund the account or reduce the order size.');
    this.name = 'InsufficientBalanceError';
  }
}

/** Kraken's dry-run validation rejected an order. */
export class ValidationFailedError extends CexError {
  constructor(message = 'Order validation failed') {
    super(
      'CEX_VALIDATION_FAILED',
      message,
      'Check the order parameters against the pair metadata and try again.',
    );
    this.name = 'ValidationFailedError';
  }
}

/** Requested trading pair is unknown to Kraken. */
export class PairNotFoundError extends CexError {
  constructor(message = 'Pair not found') {
    super('CEX_PAIR_NOT_FOUND', message, 'Use getAssetPairs() to see available pairs.');
    this.name = 'PairNotFoundError';
  }
}

/** Kraken rate limit hit after client backoff/retry. */
export class RateLimitedError extends CexError {
  constructor(message = 'Kraken rate limit exceeded') {
    super('CEX_RATE_LIMITED', message, 'Back off and retry after a short delay.');
    this.name = 'RateLimitedError';
  }
}

/** Kraken unreachable or in maintenance. */
export class VenueUnavailableError extends CexError {
  constructor(message = 'Kraken is currently unavailable') {
    super('CEX_VENUE_UNAVAILABLE', message, "Check Kraken's status page and try again later.");
    this.name = 'VenueUnavailableError';
  }
}

/** Persistent nonce error (usually client clock skew). */
export class InvalidNonceError extends CexError {
  constructor(message = 'Invalid nonce') {
    super(
      'CEX_INVALID_NONCE',
      message,
      "The client retries once with a fresh nonce; if this persists, check your machine's clock.",
    );
    this.name = 'InvalidNonceError';
  }
}

/** Fallback for Kraken errors that are not explicitly mapped. */
export class UnknownCexError extends CexError {
  constructor(message = 'Unknown CEX error') {
    super('CEX_UNKNOWN', message, "Check Kraken's status page or retry the request.");
    this.name = 'UnknownCexError';
  }
}

/**
 * Translate a single Kraken error string into the right CexError subclass.
 * Substring match; first match wins. Unknowns fall through to UnknownCexError.
 *
 * Ported from the server adapter's `_map_error`.
 */
export function mapError(krakenError: string): CexError {
  const err = krakenError || '';

  // Auth — wrong/revoked key or bad signature.
  if (err.includes('EAPI:Invalid key') || err.includes('EAPI:Invalid signature')) {
    return new InvalidCredentialsError(err);
  }
  if (err.includes('EGeneral:Permission denied')) {
    return new PermissionDeniedError(err);
  }

  // Nonce
  if (err.includes('EAPI:Invalid nonce')) {
    return new InvalidNonceError(err);
  }

  // Rate limits — check before generic service errors.
  if (
    err.includes('EAPI:Rate limit exceeded') ||
    err.includes('EOrder:Rate limit exceeded') ||
    err.includes('EOrder:Domain rate limit exceeded')
  ) {
    return new RateLimitedError(err);
  }

  // Service unavailability
  if (
    err.includes('EService:Unavailable') ||
    err.includes('EService:Busy') ||
    err.includes('EService:Market in cancel_only mode') ||
    err.includes('EService:Market in post_only mode')
  ) {
    return new VenueUnavailableError(err);
  }

  // Order validation errors
  if (err.includes('EOrder:Insufficient funds')) {
    return new InsufficientBalanceError(err);
  }
  if (err.includes('EOrder:Order minimum not met')) {
    return new OrderMinNotMetError(err);
  }
  if (err.includes('EOrder:Cost minimum not met')) {
    return new CostMinNotMetError(err);
  }
  if (err.includes('EOrder:Tick size check failed')) {
    return new TickSizeInvalidError(err);
  }
  if (err.includes('EOrder:Invalid price')) {
    return new ValidationFailedError(err);
  }

  // Pair / asset
  if (err.includes('EQuery:Unknown asset pair')) {
    return new PairNotFoundError(err);
  }

  return new UnknownCexError(err);
}

/**
 * Translate a list of raw Kraken error strings. The first mappable error wins;
 * if all fall through to UnknownCexError, concatenate them.
 *
 * Ported from the server adapter's `_translate`.
 */
export function translateErrors(errors: string[]): CexError {
  if (!errors || errors.length === 0) {
    return new UnknownCexError('Unknown Kraken error');
  }
  for (const raw of errors) {
    const mapped = mapError(raw);
    if (!(mapped instanceof UnknownCexError)) {
      return mapped;
    }
  }
  return new UnknownCexError(errors.join('; '));
}
