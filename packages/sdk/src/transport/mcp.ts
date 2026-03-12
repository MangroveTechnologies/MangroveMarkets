import type { Transport, ToolCallResult } from '../types/transport';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * MCP protocol transport using Streamable HTTP. Primary transport for agent communication.
 */
export class McpTransport implements Transport {
  private url: string;
  private apiKey?: string;
  private client: Client | null = null;

  /**
   * Create an MCP transport targeting the given server URL.
   * @param url - MCP server endpoint URL.
   * @param apiKey - Optional Bearer token for authenticated requests.
   */
  constructor(url: string, apiKey?: string) {
    this.url = url;
    this.apiKey = apiKey;
  }

  async connect(): Promise<void> {
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const mcpTransport = new StreamableHTTPClientTransport(
      new URL(this.url),
      { requestInit: { headers } },
    );

    this.client = new Client({ name: 'mangrove-sdk', version: '0.1.0' });
    await this.client.connect(mcpTransport);
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }
    const result = await this.client.callTool({ name, arguments: params });
    const textContent = (result.content as any[])?.find((c: any) => c.type === 'text');
    if (!textContent) {
      throw new Error(`No text content in response for tool: ${name}`);
    }
    try {
      return JSON.parse(textContent.text);
    } catch {
      throw new Error(`Invalid JSON in MCP response for tool '${name}'`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
