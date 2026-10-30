/** Access granted by the user's Kraken OAuth consent. */
export type KrakenConnectionMode = 'view' | 'execute';

/** Request fields accepted by the Kraken OAuth proxy for a spot order. */
export interface KrakenOrderParams {
  base: string;
  quote: string;
  side: 'buy' | 'sell';
  volume: string;
  orderType?: 'market' | 'limit';
  limitPrice?: string;
  clientRef?: string;
  /** Ask Kraken to validate the order without placing it. */
  validateOnly?: boolean;
}

/** JSON object returned by the Kraken OAuth proxy. */
export type CexResponse = Record<string, unknown>;
