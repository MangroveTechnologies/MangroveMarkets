/** Error returned by the authenticated Kraken OAuth proxy. */
export class CexProxyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseHeaders: Record<string, string>,
    public readonly responseBody: unknown,
    public readonly code = 'CEX_PROXY_ERROR',
  ) {
    super(message);
    this.name = 'CexProxyError';
  }
}
