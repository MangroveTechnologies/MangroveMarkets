export interface MangrovePluginConfig {
  url: string;
  transport: 'mcp' | 'rest';
  apiKey?: string;
}

export function loadConfig(): MangrovePluginConfig {
  return {
    url: process.env.MANGROVE_MCP_URL || 'http://localhost:8080',
    transport: (process.env.MANGROVE_TRANSPORT as 'mcp' | 'rest') || 'mcp',
    apiKey: process.env.MANGROVE_API_KEY,
  };
}
