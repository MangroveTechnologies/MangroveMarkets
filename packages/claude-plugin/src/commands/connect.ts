export interface ConnectResult {
  url: string;
  transport: 'mcp' | 'rest';
}

/**
 * Handle the /mangrove-connect command. Returns connection parameters
 * for establishing or re-establishing a connection to the MCP server.
 * @param url - The MCP server URL to connect to
 * @param transport - The transport protocol to use (defaults to 'mcp')
 * @returns Connect result with the resolved url and transport
 */
export function handleConnect(url: string, transport?: 'mcp' | 'rest'): ConnectResult {
  return { url, transport: transport ?? 'mcp' };
}
