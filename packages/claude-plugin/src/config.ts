export interface MangrovePluginConfig {
  url: string;
  transport: 'mcp' | 'rest';
  apiKey?: string;
}

/**
 * Load plugin configuration from environment variables.
 * Falls back to localhost defaults for local development.
 * @returns The resolved plugin configuration
 */
export function loadConfig(): MangrovePluginConfig {
  return {
    url: process.env.MANGROVE_MCP_URL || 'http://localhost:8080',
    transport: (process.env.MANGROVE_TRANSPORT as 'mcp' | 'rest') || 'mcp',
    apiKey: process.env.MANGROVE_API_KEY,
  };
}
