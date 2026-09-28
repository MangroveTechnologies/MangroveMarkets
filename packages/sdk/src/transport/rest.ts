import type { Transport, ToolCallResult, ToolResponse } from '../types/transport';

import { RESULT_FORMAT, RESULT_FORMAT_HEADER, ToolCallError, dataFromResponse, legacyResponse, parseResult } from './results';

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * REST API transport using native fetch. Calls POST /api/v1/tools/{name} on the FastAPI server.
 */
export class RestTransport implements Transport {
  private baseUrl: string;
  private apiKey?: string;

  /**
   * Create a REST transport targeting the given base URL with optional API key.
   * @param baseUrl - Base URL of the FastAPI server (trailing slash is stripped). Must use HTTPS unless localhost.
   * @param apiKey - Optional Bearer token for authenticated requests.
   */
  constructor(baseUrl: string, apiKey?: string, private readonly timeoutMs = 30_000) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive safe integer");
    }
    const url = baseUrl.replace(/\/$/, '');
    const parsed = new URL(url);
    if (parsed.username || parsed.password || (parsed.protocol !== 'https:' &&
        !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)))) {
      throw new Error('RestTransport requires HTTPS for non-local URLs and forbids URL credentials');
    }
    this.baseUrl = url;
    this.apiKey = apiKey;
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    return dataFromResponse(await this.invoke(name, params, false));
  }

  async callToolResult(name: string, params: Record<string, unknown>): Promise<ToolResponse> {
    return this.invoke(name, params, true);
  }

  private async invoke(name: string, params: Record<string, unknown>, full: boolean): Promise<ToolResponse> {
    if (!TOOL_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid tool name: ${name}`);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (full) headers[RESULT_FORMAT_HEADER] = RESULT_FORMAT;
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/tools/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const responseHeaders = response.headers ? Object.fromEntries(response.headers.entries()) : {};
    let body: unknown;
    try { body = await response.json(); } catch {
      throw new ToolCallError(`Invalid JSON response (HTTP ${response.status})`, 'MALFORMED_RESPONSE',
        { result: { content: [], isError: true }, status: response.status, headers: responseHeaders });
    }
    const legacy = legacyResponse(body, response.status, responseHeaders);
    if (!response.ok) {
      const data = legacy.result.structuredContent;
      throw new ToolCallError(
        `REST call failed (${response.status}): ${typeof data?.message === 'string' ? data.message : 'HTTP error'}`,
        typeof data?.code === 'string' ? data.code : 'HTTP_ERROR', legacy,
        typeof data?.suggestion === 'string' ? data.suggestion : undefined,
      );
    }
    if (!full) return legacy;
    if (response.headers?.get(RESULT_FORMAT_HEADER) !== RESULT_FORMAT) {
      // The operation may have executed on an older server. Never replay it.
      throw new ToolCallError('Server did not acknowledge full results; do not automatically retry the operation',
        'UNSUPPORTED_RESULT_FORMAT', legacy);
    }
    try {
      return { result: parseResult(body), status: response.status, headers: responseHeaders };
    } catch (error) {
      if (!(error instanceof ToolCallError)) throw error;
      // Preserve HTTP evidence without presenting invalid data as a validated result.
      throw new ToolCallError(error.message, error.code,
        { result: { content: [], isError: true }, status: response.status, headers: responseHeaders },
        undefined, body);
    }
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
