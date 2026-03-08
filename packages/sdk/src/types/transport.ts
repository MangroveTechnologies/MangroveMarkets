/**
 * Raw parsed JSON response from a tool call.
 */
export interface ToolCallResult {
  [key: string]: unknown;
}

/**
 * Interface for communicating with the MangroveMarkets MCP server.
 * Implementations: McpTransport (primary), RestTransport (fallback).
 */
export interface Transport {
  /**
   * Invoke an MCP tool by name with parameters. Returns parsed JSON response.
   * @param name - Tool name (e.g. 'dex_get_quote', 'oneinch_balances').
   * @param params - Tool parameters as key-value pairs.
   * @returns Parsed JSON response from the server.
   */
  callTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult>;

  /** Open the transport connection to the server. */
  connect(): Promise<void>;

  /** Close the transport connection and release resources. */
  disconnect(): Promise<void>;
}
