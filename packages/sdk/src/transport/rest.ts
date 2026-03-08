import type { Transport, ToolCallResult } from '../types/transport';

/**
 * REST API transport using native fetch. Calls POST /api/v1/tools/{name} on the FastAPI server.
 */
export class RestTransport implements Transport {
  private baseUrl: string;
  private apiKey?: string;

  /**
   * Create a REST transport targeting the given base URL with optional API key.
   * @param baseUrl - Base URL of the FastAPI server (trailing slash is stripped).
   * @param apiKey - Optional Bearer token for authenticated requests.
   */
  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/api/tools/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        `REST call to ${name} failed (${response.status}): ${body.message || response.statusText}`,
      );
    }

    return response.json();
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
