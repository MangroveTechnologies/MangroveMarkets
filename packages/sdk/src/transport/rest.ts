import type { Transport, ToolCallResult } from '../types/transport';

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
  constructor(baseUrl: string, apiKey?: string) {
    const url = baseUrl.replace(/\/$/, '');
    if (!url.startsWith('https://') && !url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
      throw new Error(`RestTransport requires HTTPS for non-local URLs (got: ${url})`);
    }
    this.baseUrl = url;
    this.apiKey = apiKey;
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    if (!TOOL_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid tool name: ${name}`);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/tools/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(
        `REST call to ${name} failed (${response.status}): ${(body as any).message || response.statusText}`,
      );
    }

    const body = await response.json() as ToolCallResult;

    // Server wraps errors as {error: true, code: "...", message: "..."}
    if (body && (body as any).error === true) {
      const msg = (body as any).message || (body as any).code || 'unknown error';
      throw new Error(`Tool ${name} failed: ${msg}`);
    }

    return body;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
